/**
 * DCLM Field Utility — Client-Side IndexedDB Repository
 * 100% Offline Persistence Layer
 */

const DCLM_DB = (function () {
  const DB_NAME = "dclm_field_utility_db";
  const DB_VERSION = 9;

  const STORES = {
    active_setup: "key",             // Active Ecclesiastical Identity
    worker_roster: "cache_key",       // Cached worker per account/location scope
    counts_queue: "client_id",        // Unsubmitted Headcounts
    offerings_queue: "client_id",     // Unsubmitted Offerings & Tithes
    attendance_queue: "client_id",    // Unsubmitted Marked Attendance
    registration_queue: "client_id",  // Unsubmitted Converts & Newcomers
    worker_candidates_queue: "client_id",
    fellowship_members_queue: "client_id",
    fellowship_attendance_queue: "client_id",
    fellowship_offerings_queue: "client_id",
    submission_edits_queue: "client_id", // Offline edits; the server remains authoritative for edit windows.
    recent_submissions: "client_id",  // Confirmed synced history
    auth_state: "key",                 // Last authorized profile only; never tokens
    count_draft: "key",                // In-progress demographic count per account
    attendance_confirmed: "cache_key", // Minimal event/worker duplicate guard
    app_settings: "key",               // Account-scoped field capture preferences
  };

  let dbInstance = null;

  function currentOwnerId() {
    return String(window.DCLM_CURRENT_USER?.user_id || "");
  }

  function openDatabase() {
    if (dbInstance) return Promise.resolve(dbInstance);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (event.oldVersion < 4 && db.objectStoreNames.contains("worker_roster")) {
          db.deleteObjectStore("worker_roster"); // Derived cache; queues and drafts are preserved.
        }
        Object.entries(STORES).forEach(([storeName, keyPath]) => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath });
          }
        });
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };

      request.onerror = (event) => {
        console.error("IndexedDB Open Error:", event.target.error);
        reject(event.target.error);
      };
    });
  }

  async function performTx(storeName, mode, callback) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let result;

      try {
        result = callback(store, tx);
      } catch (err) {
        reject(err);
        return;
      }

      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    });
  }

  function reqToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return {
    // Active Setup Store
    async getActiveSetup() {
      const ownerId = currentOwnerId();
      if (!ownerId) return null;
      return performTx("active_setup", "readonly", (store) => {
        return reqToPromise(store.get(`active_identity:${ownerId}`));
      });
    },

    async getSubmissionMode() {
      const ownerId = currentOwnerId();
      if (!ownerId) return "instant";
      const setting = await performTx("app_settings", "readonly", (store) => reqToPromise(store.get(`submission_mode:${ownerId}`)));
      return setting?.value === "queue_first" ? "queue_first" : "instant";
    },

    async getHapticsEnabled() {
      const ownerId = currentOwnerId();
      if (!ownerId) return true;
      const setting = await performTx("app_settings", "readonly", (store) => reqToPromise(store.get(`haptics:${ownerId}`)));
      return setting?.value !== false;
    },

    async saveHapticsEnabled(value) {
      const ownerId = currentOwnerId();
      if (!ownerId) throw new Error("Sign in before changing touch feedback preferences.");
      return performTx("app_settings", "readwrite", (store) => reqToPromise(store.put({
        key: `haptics:${ownerId}`, owner_id: ownerId, value: Boolean(value), updated_at: new Date().toISOString(),
      })));
    },

    async saveSubmissionMode(value) {
      const ownerId = currentOwnerId();
      if (!ownerId) throw new Error("Sign in before changing submission preferences.");
      const mode = value === "queue_first" ? "queue_first" : "instant";
      return performTx("app_settings", "readwrite", (store) => reqToPromise(store.put({
        key: `submission_mode:${ownerId}`, owner_id: ownerId, value: mode, updated_at: new Date().toISOString(),
      })));
    },

    async saveActiveSetup(identity) {
      const ownerId = currentOwnerId();
      if (!ownerId) throw new Error("Sign in before saving program setup.");
      return performTx("active_setup", "readwrite", (store) => {
        return reqToPromise(store.put({ key: `active_identity:${ownerId}`, owner_id: ownerId, ...identity }));
      });
    },

    async clearActiveSetup() {
      const ownerId = currentOwnerId();
      if (!ownerId) return;
      return performTx("active_setup", "readwrite", (store) => reqToPromise(store.delete(`active_identity:${ownerId}`)));
    },

    async clearAttendanceMarks(eventId) {
      const ownerId = currentOwnerId();
      if (!ownerId) return;
      return performTx("worker_roster", "readwrite", async (store) => {
        const workers = await reqToPromise(store.getAll());
        for (const worker of workers) {
          if (worker.owner_id !== ownerId || (eventId && worker.marked_event_id !== eventId)) continue;
          worker.marked_event_id = null;
          worker.marked_at = null;
          store.put(worker);
        }
      });
    },

    // Worker Roster Store
    async getWorkerRoster(locationId = "", eventId = "") {
      const ownerId = currentOwnerId();
      if (!ownerId) return [];
      return performTx("worker_roster", "readonly", (store) => {
        return reqToPromise(store.getAll()).then((items) => items
          .filter((item) => item.owner_id === ownerId && (!locationId || item.location_id === locationId))
          .map((item) => ({
            ...item,
            marked_present: Boolean(eventId && item.marked_event_id === eventId),
          })));
      });
    },

    async saveWorkerRoster(workers, locationId) {
      const ownerId = currentOwnerId();
      if (!ownerId) throw new Error("Sign in before caching the worker roster.");
      return performTx("worker_roster", "readwrite", async (store) => {
        const existing = await reqToPromise(store.getAll());
        const oldForLocation = existing.filter((worker) => worker.owner_id === ownerId && worker.location_id === locationId);
        const marks = new Map(oldForLocation.map((worker) => [worker.worker_id, {
          marked_event_id: worker.marked_event_id || null,
          marked_at: worker.marked_at || null,
        }]));
        for (const worker of oldForLocation) {
          await reqToPromise(store.delete(worker.cache_key));
        }
        workers.forEach((worker) => store.put({
          ...worker, location_id: locationId, ...marks.get(worker.worker_id), cached_at: new Date().toISOString(),
          cache_key: `${ownerId}:${worker.worker_id}`, owner_id: ownerId,
        }));
      });
    },

    async updateWorkerCheck(workerId, markedPresent, eventId) {
      return performTx("worker_roster", "readwrite", async (store) => {
        const ownerId = currentOwnerId();
        const worker = ownerId ? await reqToPromise(store.get(`${ownerId}:${workerId}`)) : null;
        if (worker) {
          worker.marked_event_id = markedPresent ? eventId : null;
          worker.marked_at = markedPresent ? new Date().toISOString() : null;
          store.put(worker);
        }
      });
    },

    // Generic Queue Operations (Counts, Offerings, Attendance, Registrations)
    async addToQueue(storeName, item) {
      if (storeName !== "recent_submissions") {
        const ownerId = currentOwnerId();
        if (!ownerId) throw new Error("Sign in before saving field records.");
        item = {
          status: "pending",
          attempt_count: 0,
          queued_at: new Date().toISOString(),
          ...item,
          owner_id: ownerId,
        };
      } else if (currentOwnerId()) {
        item = { ...item, owner_id: currentOwnerId() };
      }
      return performTx(storeName, "readwrite", (store) => {
        return reqToPromise(store.put(item));
      });
    },

    async getAllFromQueue(storeName) {
      const ownerId = currentOwnerId();
      if (!ownerId) return [];
      return performTx(storeName, "readonly", (store) => {
        return reqToPromise(store.getAll()).then((items) => items
          .filter((item) => item.owner_id === ownerId)
          .map((item) => ["counts_queue", "offerings_queue", "attendance_queue", "registration_queue", "worker_candidates_queue", "fellowship_members_queue", "fellowship_attendance_queue", "fellowship_offerings_queue", "submission_edits_queue"].includes(storeName)
            ? {
              ...item,
              status: item.status === "syncing" ? "pending" : (item.status || "pending"),
              attempt_count: Number(item.attempt_count || 0),
              attempt_count: Number(item.attempt_count || 0),
            }
            : item));
      });
    },

    async updateQueueItems(storeName, items) {
      const ownerId = currentOwnerId();
      if (!ownerId) throw new Error("Sign in before updating saved records.");
      return performTx(storeName, "readwrite", (store) => {
        for (const item of items) {
          if (item.owner_id === ownerId) store.put(item);
        }
      });
    },

    async pruneRecentSubmissions(maxRecords = 50) {
      const recent = await this.getAllFromQueue("recent_submissions");
      recent.sort((a, b) => new Date(b.synced_at) - new Date(a.synced_at));
      for (const oldItem of recent.slice(maxRecords)) {
        await this.removeFromQueue("recent_submissions", oldItem.client_id);
      }
    },

    async getAttendanceSubmittedWorkerIds(eventId) {
      const [recent, confirmed] = await Promise.all([
        this.getAllFromQueue("recent_submissions"),
        this.getAllFromQueue("attendance_confirmed"),
      ]);
      return new Set([...recent, ...confirmed]
        .filter((item) => String(item.context_key || item.event_id || "") === String(eventId)
          && (item.type === undefined || item.type === "Attendance"))
        .flatMap((item) => [item.worker_id, ...(Array.isArray(item.present_workers) ? item.present_workers.map((worker) => worker.worker_id) : [])])
        .map((workerId) => String(workerId || ""))
        .filter(Boolean));
    },

    async getAttendancePendingWorkerIds(eventId) {
      const pending = await this.getAllFromQueue("attendance_queue");
      return new Set(pending
        .filter((item) => String(item.context_key || item.event_id || "") === String(eventId))
        .flatMap((item) => [item.worker_id, ...(Array.isArray(item.present_workers) ? item.present_workers.map((worker) => worker.worker_id) : [])])
        .map((workerId) => String(workerId || ""))
        .filter(Boolean));
    },

    async normalizeLegacyAttendanceQueue() {
      const pending = await this.getAllFromQueue("attendance_queue");
      const groups = new Map();
      for (const item of pending) {
        if (Array.isArray(item.present_workers) || !item.worker_id) continue;
        const contextKey = item.context_key || item.event_id || `routine:${item.location_id}:${item.service_date}`;
        const key = [contextKey, item.location_id, item.service_date, item.church_type, item.program_domain, item.program_type].join("|");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
      }
      let converted = 0;
      for (const items of groups.values()) {
        const first = items[0];
        const contextKey = first.context_key || first.event_id || `routine:${first.location_id}:${first.service_date}`;
        const roster = await this.getWorkerRoster(first.location_id, contextKey);
        if (!roster.length) continue;
        const workers = new Map();
        for (const item of items) workers.set(String(item.worker_id), {
          worker_id: item.worker_id,
          worker_name: item.worker_name || "Church Worker",
        });
        const capture = {
          ...first,
          client_id: first.client_id,
          context_key: contextKey,
          expected_workers_count: roster.length,
          present_workers: Array.from(workers.values()),
          submitted_by_worker_id: window.DCLM_CURRENT_USER?.worker_id || null,
          last_error: items.find((item) => item.last_error)?.last_error || null,
          converted_from_legacy: true,
        };
        await this.addToQueue("attendance_queue", capture);
        for (const item of items.slice(1)) await this.removeFromQueue("attendance_queue", item.client_id);
        converted += items.length;
      }
      return converted;
    },

    async confirmAttendance(workerId, eventId) {
      const ownerId = currentOwnerId();
      if (!ownerId || !workerId || !eventId) return;
      return performTx("attendance_confirmed", "readwrite", (store) => reqToPromise(store.put({
        cache_key: `${ownerId}:${eventId}:${workerId}`,
        owner_id: ownerId,
        event_id: eventId,
        context_key: eventId,
        worker_id: workerId,
        confirmed_at: new Date().toISOString(),
      })));
    },

    async getUnassignedQueueCount() {
      const queueNames = ["counts_queue", "offerings_queue", "attendance_queue", "registration_queue", "worker_candidates_queue", "fellowship_members_queue", "fellowship_attendance_queue", "fellowship_offerings_queue"];
      const db = await openDatabase();
      const ownerId = currentOwnerId();
      if (!ownerId) return 0;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(queueNames, "readonly");
        let total = 0;
        queueNames.forEach((name) => {
          const request = tx.objectStore(name).getAll();
          request.onsuccess = () => { total += request.result.filter((item) => !item.owner_id).length; };
        });
        tx.oncomplete = () => resolve(total);
        tx.onerror = () => reject(tx.error);
      });
    },

    async claimUnassignedQueueItems() {
      const ownerId = currentOwnerId();
      if (!ownerId) throw new Error("Sign in before assigning saved records.");
      const queueNames = ["counts_queue", "offerings_queue", "attendance_queue", "registration_queue", "worker_candidates_queue", "fellowship_members_queue", "fellowship_attendance_queue", "fellowship_offerings_queue"];
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(queueNames, "readwrite");
        let claimed = 0;
        queueNames.forEach((name) => {
          const store = tx.objectStore(name);
          const request = store.getAll();
          request.onsuccess = () => request.result.filter((item) => !item.owner_id).forEach((item) => {
            store.put({ status: "pending", attempt_count: 0, ...item, owner_id: ownerId });
            claimed += 1;
          });
        });
        tx.oncomplete = () => resolve(claimed);
        tx.onerror = () => reject(tx.error);
      });
    },

    async removeFromQueue(storeName, key) {
      const ownerId = currentOwnerId();
      if (!ownerId) return false;
      return performTx(storeName, "readwrite", async (store) => {
        const item = await reqToPromise(store.get(key));
        if (!item || item.owner_id !== ownerId) return false;
        await reqToPromise(store.delete(key));
        return true;
      });
    },

    async clearQueue(storeName) {
      const ownerId = currentOwnerId();
      if (!ownerId) return;
      return performTx(storeName, "readwrite", async (store) => {
        const items = await reqToPromise(store.getAll());
        for (const item of items) {
          if (item.owner_id === ownerId) await reqToPromise(store.delete(item[STORES[storeName]]));
        }
      });
    },

    async saveAuthState(user) {
      return performTx("auth_state", "readwrite", (store) => {
        store.delete("session_status");
        return reqToPromise(store.put({ key: "current_user", ...user }));
      });
    },

    async saveFellowshipContext(context) {
      const ownerId = currentOwnerId();
      if (!ownerId) return;
      return performTx("active_setup", "readwrite", (store) => reqToPromise(store.put({
        key: `fellowship_context:${ownerId}`, owner_id: ownerId, ...context,
      })));
    },

    async getFellowshipContext() {
      const ownerId = currentOwnerId();
      if (!ownerId) return null;
      return performTx("active_setup", "readonly", (store) => reqToPromise(store.get(`fellowship_context:${ownerId}`)));
    },

    async getAuthState() {
      const state = await performTx("auth_state", "readonly", (store) => reqToPromise(store.get("current_user")));
      if (!state) return null;
      const { key, ...user } = state;
      return user;
    },

    async clearAuthState() {
      return performTx("auth_state", "readwrite", (store) => {
        store.delete("current_user");
        return reqToPromise(store.delete("session_status"));
      });
    },

    async markSignedOut() {
      return performTx("auth_state", "readwrite", (store) => {
        store.delete("current_user");
        return reqToPromise(store.put({ key: "session_status", signed_out: true }));
      });
    },

    async isSignedOut() {
      const status = await performTx("auth_state", "readonly", (store) => reqToPromise(store.get("session_status")));
      return Boolean(status?.signed_out);
    },

    async saveCountDraft(draft) {
      const ownerId = currentOwnerId();
      if (!ownerId) throw new Error("Sign in before saving a count draft.");
      return performTx("count_draft", "readwrite", (store) => reqToPromise(store.put({
        key: `count_draft:${ownerId}`, owner_id: ownerId, ...draft,
      })));
    },

    async getCountDraft() {
      const ownerId = currentOwnerId();
      if (!ownerId) return null;
      return performTx("count_draft", "readonly", (store) => reqToPromise(store.get(`count_draft:${ownerId}`)));
    },

    async clearCountDraft() {
      const ownerId = currentOwnerId();
      if (!ownerId) return;
      return performTx("count_draft", "readwrite", (store) => reqToPromise(store.delete(`count_draft:${ownerId}`)));
    },

    // Total Count of unsubmitted items across all queues
    async getPendingCounts() {
      const counts = await this.getAllFromQueue("counts_queue");
      const offerings = await this.getAllFromQueue("offerings_queue");
      const attendance = await this.getAllFromQueue("attendance_queue");
      const registrations = await this.getAllFromQueue("registration_queue");
      const workerCandidates = await this.getAllFromQueue("worker_candidates_queue");
      const fellowshipMembers = await this.getAllFromQueue("fellowship_members_queue");
      const fellowshipAttendance = await this.getAllFromQueue("fellowship_attendance_queue");
      const fellowshipOfferings = await this.getAllFromQueue("fellowship_offerings_queue");

      return {
        counts: counts.length,
        offerings: offerings.length,
        attendance: attendance.length,
        registrations: registrations.length,
        worker_candidates: workerCandidates.length,
        fellowship_members: fellowshipMembers.length,
        fellowship_attendance: fellowshipAttendance.length,
        fellowship_offerings: fellowshipOfferings.length,
        total: counts.length + offerings.length + attendance.length + registrations.length + workerCandidates.length
          + fellowshipMembers.length + fellowshipAttendance.length + fellowshipOfferings.length,
      };
    },
  };
})();
