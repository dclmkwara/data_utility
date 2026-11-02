/** Lossless per-record sync for Church_server's batch contract. */
const DCLM_SYNC = (function () {
  const QUEUES = [
    ["counts_queue", "counts", "Headcount"],
    ["offerings_queue", "offerings", "Offering"],
    ["registration_queue", "records", "Registration"],
    ["attendance_queue", "worker_attendance", "Attendance"],
  ];

  function payloadFor(group, item) {
    if (group.field === "counts") return {
      client_id: item.client_id, event_id: item.event_id, location_id: item.location_id,
      assignment_id: item.assignment_id || null,
      adult_male: Number(item.adult_male || 0), adult_female: Number(item.adult_female || 0),
      youth_male: Number(item.youth_male || 0), youth_female: Number(item.youth_female || 0),
      boys: Number(item.boys || 0), girls: Number(item.girls || 0), note: item.note || null,
      submission_channel: "field_utility",
    };
    if (group.field === "offerings") return {
      client_id: item.client_id, event_id: item.event_id, location_id: item.location_id,
      amount: String(item.amount), payment_method: item.payment_method || "cash",
      fund_type: item.fund_type || "offering", note: item.note || null,
    };
    if (group.field === "records") return {
      client_id: item.client_id, event_id: item.event_id, location_id: item.location_id,
      assignment_id: item.assignment_id || null,
      record_type: item.record_type, name: item.name, gender: item.gender, phone: item.phone,
      details: item.details || {}, note: item.note || null, submission_channel: "field_utility",
    };
    return {
      client_id: item.client_id, event_id: item.event_id, location_id: item.location_id,
      worker_id: item.worker_id, status: item.status || "present", reason: item.reason || null,
      note: item.note || null,
    };
  }

  async function syncAllQueues() {
    if (!navigator.onLine) {
      DCLM_APP.showToast("Device is offline. Saved records remain on this device.", "warning");
      return { ok: false, offline: true };
    }
    const groups = await Promise.all(QUEUES.map(async ([store, field, label]) => ({
      store, field, label, items: await DCLM_DB.getAllFromQueue(store),
    })));
    const entries = groups.flatMap((group) => group.items.map((item) => ({ group, item })));
    if (!entries.length) {
      DCLM_APP.showToast("No pending records to sync.", "info");
      return { ok: true, synced: 0 };
    }

    const eligible = [];
    let failed = 0;
    for (const entry of entries) {
      if (!entry.item.client_id || !entry.item.location_id || !entry.item.event_id) {
        failed += 1;
        await DCLM_DB.addToQueue(entry.group.store, {
          ...entry.item,
          last_error: "Select a valid event and location before syncing this record.",
        });
      } else eligible.push(entry);
    }
    if (!eligible.length) {
      DCLM_APP.showToast(`${failed} record(s) need a valid event and location before they can sync.`, "warning");
      return { ok: false, synced: 0, failed };
    }

    let synced = 0;
    let networkError = null;
    for (let offset = 0; offset < eligible.length; offset += 500) {
      const chunk = eligible.slice(offset, offset + 500);
      const payload = Object.fromEntries(QUEUES.map(([, field]) => [field, []]));
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
      try {
        response = await window.DCLM_AUTH.apiFetch("/api/sync", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        result = await response.json();
        if (!response.ok || result.ok === false) throw new Error(result.error || `Server rejected batch (${response.status})`);
      } catch (error) {
        networkError = error.message || "Unable to contact Church_server.";
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
        const details = result[group.field]?.details;
        const outcome = Array.isArray(details)
          ? details.find((row) => String(row.client_id) === String(item.client_id))
          : null;
        if (outcome && ["synced", "duplicate"].includes(outcome.status)) {
          if (group.field === "worker_attendance") {
            await DCLM_DB.confirmAttendance(item.worker_id, item.event_id);
          }
          await DCLM_DB.addToQueue("recent_submissions", {
            client_id: item.client_id, type: group.label, synced_at: now, outcome: outcome.status,
            location_id: item.location_id, service_date: item.service_date || null,
            event_id: item.event_id, worker_id: item.worker_id || null,
          });
          await DCLM_DB.removeFromQueue(group.store, item.client_id);
          synced += 1;
        } else {
          failed += 1;
          const message = String(outcome?.error || "Church_server did not confirm this record.").slice(0, 300);
          await DCLM_DB.addToQueue(group.store, { ...item, status: "pending", last_error: message });
        }
      }
      await DCLM_DB.pruneRecentSubmissions();
    }

    if (typeof DCLM_APP.renderQueuesView === "function") await DCLM_APP.renderQueuesView();
    if (networkError) {
      DCLM_APP.showToast(`${synced} confirmed; remaining records are still saved. Sync stopped: ${networkError}`, "warning");
      return { ok: false, synced, failed, error: networkError };
    }
    if (failed) DCLM_APP.showToast(`${synced} confirmed; ${failed} remain queued for correction.`, "warning");
    else DCLM_APP.showToast(`${synced} record(s) confirmed by Church_server.`, "success");
    return { ok: failed === 0, synced, failed };
  }

  return { syncAllQueues };
})();
