/** Lossless sync for field records and atomic roster attendance captures. */
const DCLM_SYNC = (function () {
  const QUEUES = [
    ["counts_queue", "counts", "Headcount"],
    ["offerings_queue", "offerings", "Offering"],
    ["registration_queue", "records", "Registration"],
    ["worker_candidates_queue", "worker_candidates", "Worker Candidate"],
    ["attendance_queue", "worker_attendance_submissions", "Attendance"],
    ["fellowship_members_queue", "fellowship_members", "Fellowship Member"],
    ["fellowship_attendance_queue", "fellowship_attendance", "Fellowship Attendance"],
    ["fellowship_offerings_queue", "fellowship_offerings", "Fellowship Offering"],
  ];

  const groupForStore = (store) => {
    const [queue, field, label] = QUEUES.find(([name]) => name === store) || [];
    return queue ? { store: queue, field, label } : null;
  };

  async function postMany(group, items) {
    const payload = Object.fromEntries(QUEUES.map(([, field]) => [field, []]));
    payload.worker_attendance = [];
    payload[group.field].push(...items.map((item) => payloadFor(group, item)));
    const response = await window.DCLM_AUTH.apiFetch("/api/sync", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || result.ok === false) throw new Error(result.error || `Server rejected submission (${response.status}).`);
    return result[group.field]?.details || [];
  }

  async function rememberConfirmed(group, item, outcome) {
    const now = new Date().toISOString();
    if (group.field === "worker_attendance_submissions") {
      const contextKey = item.context_key || item.event_id || `routine:${item.location_id}:${item.service_date}`;
      for (const worker of item.present_workers || []) await DCLM_DB.confirmAttendance(worker.worker_id, contextKey);
    }
    await DCLM_DB.addToQueue("recent_submissions", {
      client_id: item.client_id, type: group.label, synced_at: now, outcome,
      location_id: item.location_id, service_date: item.service_date || null,
      event_id: item.event_id, context_key: item.context_key || null, worker_id: item.worker_id || null,
    });
    await DCLM_DB.pruneRecentSubmissions();
  }

  async function submitOrQueue(store, item, { skipEditWarning = false, forceImmediate = false } = {}) {
    const result = await submitManyOrQueue(store, [item], { skipEditWarning, forceImmediate });
    return { ...result, queued: result.queued > 0, submitted: result.submitted > 0 };
  }

  async function submitManyOrQueue(store, items, { skipEditWarning = false, forceImmediate = false } = {}) {
    const group = groupForStore(store);
    if (!group) throw new Error("Unsupported field record type.");
    if (!items.length) return { ok: true, submitted: 0, queued: 0 };
    const mode = await DCLM_DB.getSubmissionMode();
    if ((!forceImmediate && mode === "queue_first") || !navigator.onLine) {
      for (const item of items) await DCLM_DB.addToQueue(store, { ...item, last_error: null });
      await DCLM_APP.refreshHomeQueueSummary();
      await DCLM_APP.renderQueuesView();
      DCLM_APP.showToast(navigator.onLine
        ? "Saved on this device. Submit it when you are ready from Sync Queues."
        : "No connection. Saved on this device and ready to submit when you are online.", "success");
      return { ok: true, submitted: 0, queued: items.length };
    }
    if (!skipEditWarning && ["offerings_queue", "attendance_queue", "fellowship_attendance_queue", "fellowship_offerings_queue"].includes(store)
      && !(await window.DCLM_APP.confirm("Editing this record after submission requires elevated approval. Submit this record now?", { title: "Confirm submission", confirmLabel: "Submit" }))) {
      return { ok: false, cancelled: true, submitted: 0, queued: 0 };
    }
    try {
      const details = await postMany(group, items);
      const resultById = new Map(details.map((detail) => [String(detail.client_id), detail]));
      let submitted = 0;
      let queued = 0;
      for (const item of items) {
        const detail = resultById.get(String(item.client_id));
        if (detail && ["synced", "duplicate"].includes(detail.status)) {
          await rememberConfirmed(group, item, detail.status);
          await DCLM_DB.removeFromQueue(store, item.client_id);
          submitted += 1;
        } else {
          const error = detail?.error || "The records service did not confirm this submission.";
          await DCLM_DB.addToQueue(store, { ...item, last_error: error });
          queued += 1;
        }
      }
      if (group.field === "worker_attendance_submissions" && submitted > 0 && queued === 0) {
        await window.DCLM_APP.onAttendanceSyncConfirmed(items[0].context_key || items[0].event_id);
      }
      await DCLM_APP.refreshHomeQueueSummary();
      await DCLM_APP.renderQueuesView();
      if (queued) DCLM_APP.showToast(`${submitted} submitted; ${queued} remain saved on this device for retry or correction.`, "warning");
      else DCLM_APP.showToast(`${submitted} ${group.label.toLowerCase()} record(s) submitted successfully.`, "success");
      return { ok: queued === 0, submitted, queued };
    } catch (error) {
      for (const item of items) await DCLM_DB.addToQueue(store, { ...item, last_error: error.message || "Submission was not confirmed." });
      await DCLM_APP.refreshHomeQueueSummary();
      await DCLM_APP.renderQueuesView();
      DCLM_APP.showToast(`Submission was not confirmed. ${items.length} record(s) were saved on this device: ${error.message}`, "warning");
      return { ok: false, submitted: 0, queued: items.length, error };
    }
  }

  function payloadFor(group, item) {
    if (group.field === "fellowship_members") return {
      client_id: item.client_id, fellowship_id: item.fellowship_id,
      name: item.name, phone: item.phone || null, address: item.address || null,
      role: "member",
    };
    if (group.field === "fellowship_attendance") return {
      client_id: item.client_id, fellowship_id: item.fellowship_id,
      date: item.date, men: Number(item.men || 0), women: Number(item.women || 0),
      youths: Number(item.youths || 0), children: Number(item.children || 0),
      topic: item.topic || null, note: item.note || null,
    };
    if (group.field === "fellowship_offerings") return {
      client_id: item.client_id, fellowship_id: item.fellowship_id,
      date: item.date, amount: String(item.amount), note: item.note || null,
    };
    if (group.field === "worker_candidates") return {
      client_id: item.client_id,
      name: item.name,
      gender: item.gender,
      phone: item.phone,
      email: item.email,
      unit: item.unit,
      address: item.address || null,
      occupation: item.occupation || null,
      marital_status: item.marital_status || null,
    };
    if (group.field === "counts") return {
      client_id: item.client_id, event_id: item.event_id || null, location_id: item.location_id,
      date: `${item.service_date}T00:00:00Z`, church_type: item.church_type,
      program_level: item.program_level || "Local",
      program_domain: item.program_domain, program_type: item.program_type,
      assignment_id: item.assignment_id || null,
      adult_male: Number(item.adult_male || 0), adult_female: Number(item.adult_female || 0),
      youth_male: Number(item.youth_male || 0), youth_female: Number(item.youth_female || 0),
      boys: Number(item.boys || 0), girls: Number(item.girls || 0), note: item.note || null,
      submission_channel: "field_utility",
    };
    if (group.field === "offerings") return {
      client_id: item.client_id, event_id: item.event_id || null, location_id: item.location_id,
      date: `${item.service_date}T00:00:00Z`, church_type: item.church_type,
      program_level: item.program_level || "Local",
      program_domain: item.program_domain, program_type: item.program_type,
      amount: String(item.amount), payment_method: item.payment_method || "cash",
      fund_type: item.fund_type || "offering", note: item.note || null,
    };
    if (group.field === "records") return {
      client_id: item.client_id, event_id: item.event_id || null, location_id: item.location_id,
      date: `${item.service_date}T00:00:00Z`, church_type: item.church_type,
      program_level: item.program_level || "Local",
      program_domain: item.program_domain, program_type: item.program_type,
      assignment_id: item.assignment_id || null,
      record_type: item.record_type, name: item.name, gender: item.gender, phone: item.phone,
      details: item.details || {}, note: item.note || null, submission_channel: "field_utility",
    };
    if (group.field === "worker_attendance_submissions") return {
      client_id: item.client_id, event_id: item.event_id || null, location_id: item.location_id,
      assignment_id: item.assignment_id || null,
      date: `${item.service_date}T00:00:00Z`, church_type: item.church_type,
      program_level: item.program_level || "Local",
      program_domain: item.program_domain, program_type: item.program_type,
      expected_workers_count: Number(item.expected_workers_count || 0),
      present_workers: (item.present_workers || []).map((worker) => ({
        worker_id: worker.worker_id, worker_name: worker.worker_name || worker.name || "Church Worker",
      })),
      submitted_by_worker_id: item.submitted_by_worker_id || null,
      note: item.note || null,
    };
    return {
      client_id: item.client_id, event_id: item.event_id || null, location_id: item.location_id,
      date: `${item.service_date}T00:00:00Z`, church_type: item.church_type,
      program_level: item.program_level || "Local",
      program_domain: item.program_domain, program_type: item.program_type,
      worker_id: item.worker_id,
      // Queue lifecycle values (pending/syncing) are never valid attendance statuses.
      status: ["present", "absent", "late", "excused"].includes(String(item.attendance_status || item.status || "").toLowerCase())
        ? String(item.attendance_status || item.status).toLowerCase() : "present",
      reason: item.reason || null,
      note: item.note || null,
    };
  }

  async function syncAllQueues() {
    if (!navigator.onLine) {
      DCLM_APP.showToast("Device is offline. Saved records remain on this device.", "warning");
      return { ok: false, offline: true };
    }
    await DCLM_DB.normalizeLegacyAttendanceQueue();
    const groups = await Promise.all(QUEUES.map(async ([store, field, label]) => ({
      store, field, label, items: await DCLM_DB.getAllFromQueue(store),
    })));
    const entries = groups.flatMap((group) => group.items.map((item) => ({ group, item })));
    if (!entries.length) {
      DCLM_APP.showToast("No pending records to sync.", "info");
      return { ok: true, synced: 0 };
    }
    const needsEditNotice = entries.some(({ group }) => ["offerings", "worker_attendance_submissions", "worker_candidates", "fellowship_attendance", "fellowship_offerings"].includes(group.field));
    if (needsEditNotice && !(await window.DCLM_APP.confirm("Some offering and attendance records are included. Editing them after submission requires elevated approval. Continue with submission?", { title: "Confirm submission", confirmLabel: "Submit all" }))) {
      return { ok: false, cancelled: true };
    }

    const eligible = [];
    let failed = 0;
    for (const entry of entries) {
      const fellowshipEntry = entry.group.field.startsWith("fellowship_");
      if (!entry.item.client_id || (entry.group.field === "worker_candidates"
        ? (!entry.item.name || !entry.item.gender || !entry.item.phone || !entry.item.email || !entry.item.unit)
        : fellowshipEntry
        ? !entry.item.fellowship_id
        : (!entry.item.location_id || !entry.item.service_date || !entry.item.program_type || !entry.item.church_type
          || (!entry.item.event_id && !entry.item.program_domain)
          || (!entry.item.event_id && String(entry.item.program_domain).toLowerCase() === "crusade")))) {
        failed += 1;
        await DCLM_DB.addToQueue(entry.group.store, {
          ...entry.item,
          last_error: entry.group.field === "worker_candidates"
            ? "Add the worker candidate's name, gender, phone, email, and unit before syncing."
            : fellowshipEntry
            ? "Select an authorized fellowship before syncing this record."
            : "Add the location, service date, program type, and required scheduled event before syncing.",
        });
      } else eligible.push(entry);
    }
    if (!eligible.length) {
      DCLM_APP.showToast(`${failed} record(s) need valid service details, a required scheduled event, or a fellowship before they can sync.`, "warning");
      return { ok: false, synced: 0, failed };
    }

    let synced = 0;
    let networkError = null;
    const confirmedAttendanceContexts = new Set();
    for (let offset = 0; offset < eligible.length; offset += 500) {
      const chunk = eligible.slice(offset, offset + 500);
      const payload = Object.fromEntries(QUEUES.map(([, field]) => [field, []]));
      payload.worker_attendance = [];
      for (const { group, item } of chunk) payload[group.field].push(payloadFor(group, item));
      const attemptedAt = new Date().toISOString();
      const attempted = chunk.map(({ group, item }) => ({
        group,
        item: { ...item, status: "syncing", attempt_count: Number(item.attempt_count || 0) + 1, last_attempt_at: attemptedAt },
      }));
      for (const group of groups) {
        const updates = attempted.filter((entry) => entry.group.store === group.store).map((entry) => entry.item);
        if (updates.length) await DCLM_DB.updateQueueItems(group.store, updates);
      }
      DCLM_APP.showToast(`Sending ${Math.min(offset + chunk.length, eligible.length)} of ${eligible.length} records…`, "info");
      let response;
      let result;
      let requestPayload;
      try {
        requestPayload = payload;
        response = await window.DCLM_AUTH.apiFetch("/api/sync", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        result = await response.json();
        if (!response.ok || result.ok === false) throw new Error(result.error || `Server rejected batch (${response.status})`);
      } catch (error) {
        networkError = error.message || "Unable to contact the church records service.";
        for (const group of groups) {
          const updates = attempted.filter((entry) => entry.group.store === group.store).map(({ item }) => ({
            ...item, status: "pending", last_error: networkError,
          }));
          if (updates.length) await DCLM_DB.updateQueueItems(group.store, updates);
        }
        break;
      }

      const now = new Date().toISOString();
      for (const { group, item } of chunk) {
        const attemptedItem = attempted.find((entry) =>
          entry.group.store === group.store && String(entry.item.client_id) === String(item.client_id)
        )?.item || item;
        const details = result[group.field]?.details;
        const outcome = Array.isArray(details)
          ? details.find((row) => String(row.client_id) === String(item.client_id))
          : null;
        if (outcome && ["synced", "duplicate"].includes(outcome.status)) {
          if (group.field === "worker_attendance_submissions") {
            const contextKey = item.context_key || item.event_id || `routine:${item.location_id}:${item.service_date}`;
            for (const worker of item.present_workers || []) await DCLM_DB.confirmAttendance(worker.worker_id, contextKey);
          }
          await DCLM_DB.addToQueue("recent_submissions", {
            client_id: item.client_id, type: group.label, synced_at: now, outcome: outcome.status,
            worker_id: item.worker_id || item.id || null,
            location_id: item.location_id, service_date: item.service_date || null,
            event_id: item.event_id, context_key: item.context_key || null, worker_id: item.worker_id || null,
          });
          await DCLM_DB.removeFromQueue(group.store, item.client_id);
          if (group.field === "worker_attendance_submissions") confirmedAttendanceContexts.add(item.context_key || item.event_id || `routine:${item.location_id}:${item.service_date}`);
          synced += 1;
        } else {
          failed += 1;
          const message = String(outcome?.error || "The church records service did not confirm this record.").slice(0, 300);
          await DCLM_DB.addToQueue(group.store, { ...attemptedItem, status: "pending", last_error: message });
        }
      }
      await DCLM_DB.pruneRecentSubmissions();
    }

    if (typeof DCLM_APP.renderQueuesView === "function") await DCLM_APP.renderQueuesView();
    if (typeof DCLM_APP.refreshHomeQueueSummary === "function") await DCLM_APP.refreshHomeQueueSummary();
    for (const contextKey of confirmedAttendanceContexts) {
      await DCLM_APP.onAttendanceSyncConfirmed(contextKey);
    }
    if (networkError) {
      DCLM_APP.showToast(`${synced} confirmed; remaining records are still saved. Sync stopped: ${networkError}`, "warning");
      return { ok: false, synced, failed, error: networkError };
    }
    if (failed) DCLM_APP.showToast(`${synced} confirmed; ${failed} remain queued for correction.`, "warning");
    else DCLM_APP.showToast(`${synced} record(s) confirmed by the church records service.`, "success");
    return { ok: failed === 0, synced, failed };
  }

  async function syncQueueItem(store, clientId) {
    if (store === "attendance_queue") {
      await DCLM_DB.normalizeLegacyAttendanceQueue();
    }
    const item = (await DCLM_DB.getAllFromQueue(store)).find((row) => String(row.client_id) === String(clientId));
    if (!item) {
      DCLM_APP.showToast("This saved record is no longer in the queue. Refresh the list and try again.", "warning");
      return { ok: false, missing: true };
    }
    if (!navigator.onLine) {
      DCLM_APP.showToast("Device is offline. This record remains saved on this device.", "warning");
      return { ok: false, offline: true };
    }
    if (store === "attendance_queue" && !Array.isArray(item.present_workers)) {
      DCLM_APP.showToast("This older attendance record cannot be submitted as a single capture yet. Refresh the worker roster, then review Sync Queues again.", "warning");
      return { ok: false, legacyAttendance: true };
    }
    const result = await submitManyOrQueue(store, [item], { forceImmediate: true });
    return result;
  }

  return { syncAllQueues, syncQueueItem, submitOrQueue, submitManyOrQueue };
})();
