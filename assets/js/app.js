/**
 * DCLM Field Utility â€” Master Application Orchestrator
 * High-performance, offline-capable mobile workflows
 */

const DCLM_APP = (function () {
  const boot = window.__DCLM_UTILITY_BOOT__ || {};
  const activeScreen = boot.active_screen || "home";
  const domainProgramTypes = boot.program_types_by_domain || {};

  let activeSetup = null;
  let assignedLocation = null;
  let assignedFellowships = [];
  let cachedRoster = [];
  let rosterState = "not_loaded";

  // Local counter tally state
  let counterState = {
    adult_male: 0,
    adult_female: 0,
    youth_male: 0,
    youth_female: 0,
    boys: 0,
    girls: 0,
  };

  function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function todayISO() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function eventContextKey(setup = activeSetup) {
    if (!setup) return "";
    return setup.event_id || `routine:${setup.location_id}:${setup.service_date}`;
  }

  function requiresScheduledEvent(setup = activeSetup) {
    return String(setup?.program_domain || "").toLowerCase() === "crusade";
  }

  async function persistCountDraft() {
    if (!activeSetup?.location_id) return;
    await DCLM_DB.saveCountDraft({
      counts: { ...counterState },
      event_id: activeSetup.event_id || null,
      location_id: activeSetup.location_id,
      setup: { ...activeSetup },
      updated_at: new Date().toISOString(),
    });
  }

  function qs(selector, scope = document) {
    return scope.querySelector(selector);
  }

  function qsa(selector, scope = document) {
    return Array.from(scope.querySelectorAll(selector));
  }

  function haptic(effect) {
    if (typeof DCLM_HAPTICS !== "undefined" && typeof DCLM_HAPTICS[effect] === "function") {
      DCLM_HAPTICS[effect]();
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/Church_server/gi, "church records service").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
  }

  function showToast(message, type = "info") {
    const container = qs("#dclm-toast-container");
    if (!container) return;

    container.className = `dclm-toast dclm-toast--${type} is-visible`;
    container.textContent = String(message || "").replace(/Church_server/gi, "church records service");

    clearTimeout(container._timer);
    container._timer = setTimeout(() => {
      container.classList.remove("is-visible");
    }, 3200);
  }

  async function refreshHomeQueueSummary() {
    const countEl = qs("#home-queue-count");
    const captionEl = qs("#home-queue-caption");
    if (!countEl && !captionEl) return;
    const pending = await DCLM_DB.getPendingCounts();
    const total = Number(pending.total || 0);
    if (countEl) countEl.textContent = `${total} pending`;
    if (captionEl) captionEl.textContent = total
      ? "Review and sync records saved on this device."
      : "No records are waiting to sync.";
  }

  function updateNetworkStatus() {
    const isOnline = navigator.onLine;
    const pill = qs("#network-status-pill");
    const text = qs("#network-status-text");

    if (pill && text) {
      pill.className = `dclm-status-pill ${isOnline ? "is-online" : "is-offline"}`;
      text.textContent = isOnline ? "Online" : "Offline";
    }
    const settingsStatus = qs("#settings-connection-status");
    if (settingsStatus) settingsStatus.textContent = isOnline
      ? "Connection: online"
      : "Connection: offline · saved records remain on this device";
  }

  // -------------------------------------------------------------
  // Setup & Identity Engine
  // -------------------------------------------------------------
  async function refreshActiveSetup() {
    activeSetup = await DCLM_DB.getActiveSetup();

    const titleEl = qs("#identity-bar-title");
    const subEl = qs("#identity-bar-sub");
    const barEl = qs("#persistent-identity-bar");
    const btnEl = qs("#identity-bar-btn");
    const shieldEl = qs("#setup-required-shield");
    const iconEl = qs("#identity-bar-icon");

    if (activeScreen === "fellowship") {
      if (barEl) barEl.className = "dclm-identity-bar is-active";
      if (iconEl) iconEl.className = "bi bi-house-heart fs-5 me-2 text-primary";
      if (titleEl) titleEl.textContent = assignedLocation?.location_name || "Home Fellowship";
      if (subEl) subEl.textContent = "Choose the assigned fellowship below; event setup is not required.";
      if (btnEl) btnEl.textContent = "Program setup";
      if (shieldEl) shieldEl.classList.add("d-none");
      qsa("[id$='-content-wrap']").forEach((el) => el.classList.remove("d-none"));
    } else if (activeSetup && activeSetup.location_id && activeSetup.service_date && activeSetup.program_type) {
      if (barEl) {
        barEl.className = "dclm-identity-bar is-active";
      }
      if (iconEl) {
        iconEl.className = "bi bi-shield-check fs-5 me-2 text-primary";
      }
      if (titleEl) {
        titleEl.textContent = `${activeSetup.church_type} â€¢ ${activeSetup.program_type} â€¢ ${activeSetup.location_id}`;
      }
      if (subEl) {
        subEl.textContent = `Scope: ${activeSetup.program_level} Level â€¢ Date: ${activeSetup.service_date}`;
      }
      if (btnEl) btnEl.textContent = "Change";
      if (shieldEl) shieldEl.classList.add("d-none");
      // Show all content wraps now that setup is active
      qsa("[id$='-content-wrap']").forEach((el) => el.classList.remove("d-none"));
    } else {
      if (barEl) {
        barEl.className = "dclm-identity-bar is-missing";
      }
      if (iconEl) {
        iconEl.className = "bi bi-exclamation-triangle fs-5 me-2 text-warning";
      }
      if (titleEl) titleEl.textContent = "Program Setup Required";
      if (subEl) subEl.textContent = "Tap to set Church Wing, Program, Level, Location & Date";
      if (btnEl) btnEl.textContent = "Set Up";
      if (shieldEl) shieldEl.classList.remove("d-none");
      // Hide all content wraps until setup is done
      qsa("[id$='-content-wrap']").forEach((el) => el.classList.add("d-none"));
    }
  }

  function bindDomainTypeSync(domainSelectId, typeSelectId) {
    const domainSelect = qs(`#${domainSelectId}`);
    const typeSelect = qs(`#${typeSelectId}`);
    if (!domainSelect || !typeSelect) return;

    domainSelect.addEventListener("change", () => {
      const selectedDomain = domainSelect.value;
      const allowedTypes = domainProgramTypes[selectedDomain] || [];

      qsa("option", typeSelect).forEach((opt) => {
        if (!opt.value) return;
        const matches = allowedTypes.includes(opt.value);
        opt.hidden = !matches;
        opt.disabled = !matches;
      });

      if (!allowedTypes.includes(typeSelect.value)) {
        typeSelect.value = "";
      }
    });
  }

  async function loadAssignedLocation() {
    const apply = (location) => {
      assignedLocation = location || null;
      for (const prefix of ["page", "modal"]) {
        const id = qs(`#${prefix}_location_id`);
        const label = qs(`#${prefix}_location_label`);
        const level = qs(`#${prefix}_program_level`);
        if (id) id.value = location?.location_id || "";
        if (label) label.value = location ? `${location.location_name} Â· ${location.formatted_id}` : "Location unavailable";
        if (level) level.value = "Local";
        const church = qs(`#${prefix}_church_type`);
        if (church && location?.church_type && Array.from(church.options).some((option) => option.value === location.church_type)) {
          church.value = location.church_type;
        }
      }
    };
    if (!navigator.onLine) {
      const saved = await DCLM_DB.getAuthState();
      const active = await DCLM_DB.getActiveSetup();
      if (saved?.location_id && active?.location_label) {
        apply({ location_id: active.assigned_location_id || saved.location_id, formatted_id: active.location_label, location_name: active.location_name || "Assigned location", church_type: saved.church_type || active.church_type || "DCLM" });
      }
      return;
    }
    try {
      const response = await window.DCLM_AUTH.apiFetch("/api/location-context");
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Could not load your assigned location.");
      apply(data.location);
      if (activeScreen === "fellowship") await refreshActiveSetup();
    } catch (error) {
      apply(null);
      showToast(error.message, "warning");
    }
  }

  async function loadProgramEvents(prefix) {
    const select = qs(`#${prefix}_event_id`);
    const locationId = qs(`#${prefix}_location_id`)?.value.trim();
    const serviceDate = qs(`#${prefix}_service_date`)?.value;
    const programType = qs(`#${prefix}_program_type`)?.value;
    if (!select) return;
    if (!locationId || !serviceDate || !programType) {
      select.replaceChildren(new Option("Select date and program first", ""));
      select.disabled = true;
      return;
    }
    if (!navigator.onLine) {
      const sameVerifiedContext = activeSetup?.location_id === locationId
        && activeSetup?.service_date === serviceDate
        && activeSetup?.program_type === programType
        && activeSetup?.event_id;
      const label = sameVerifiedContext
        ? `${activeSetup.program_type} Â· ${activeSetup.service_date} Â· Previously verified (offline)`
        : "Connect to load available scheduled events";
      select.replaceChildren(new Option(label, sameVerifiedContext ? activeSetup.event_id : ""));
      select.disabled = true;
      return;
    }
    select.replaceChildren(new Option("Loading matching eventsâ€¦", ""));
    select.disabled = true;
    try {
      const query = new URLSearchParams({ location_id: locationId, date: serviceDate, program_type: programType });
      const response = await window.DCLM_AUTH.apiFetch(`/api/events?${query}`);
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Could not load events.");
      const previous = select.value || (activeSetup?.location_id === locationId && activeSetup?.service_date === serviceDate ? activeSetup.event_id : "");
      const options = [new Option(data.items.length ? "No scheduled event selected" : "No matching event (routine services may continue without one)", "")];
      for (const event of data.items) {
        const option = new Option([event.title || event.program_type?.name || programType, event.date, event.event_mode].filter(Boolean).join(" · "), event.id);
        option.dataset.locationId = event.location_id || locationId;
        options.push(option);
      }
      select.replaceChildren(...options);
      if (previous && data.items.some((event) => String(event.id) === String(previous))) select.value = previous;
      select.disabled = false;
    } catch (error) {
      select.replaceChildren(new Option("Events unavailable; reconnect to load", ""));
      select.disabled = true;
      showToast(error.message, "warning");
    }
  }

  async function resolveEventAssignments(eventId, locationId) {
    if (!eventId || !locationId) {
      return { requires_count_assignment: false, count_assignment_id: null, requires_convert_assignment: false, convert_assignment_id: null };
    }
    if (!navigator.onLine && activeSetup?.event_id === eventId && activeSetup?.location_id === locationId) {
      return {
        requires_count_assignment: Boolean(activeSetup.requires_count_assignment),
        count_assignment_id: activeSetup.count_assignment_id || null,
        count_assignment_ambiguous: Boolean(activeSetup.count_assignment_ambiguous),
        requires_convert_assignment: Boolean(activeSetup.requires_convert_assignment),
        convert_assignment_id: activeSetup.convert_assignment_id || null,
        convert_assignment_ambiguous: Boolean(activeSetup.convert_assignment_ambiguous),
      };
    }
    const response = await window.DCLM_AUTH.apiFetch(
      `/api/events/${encodeURIComponent(eventId)}/field-assignments?location_id=${encodeURIComponent(locationId)}`,
    );
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Could not verify the count assignment.");
    const countAssignments = data.count_assignments || [];
    const convertAssignments = data.convert_assignments || [];
    return {
      requires_count_assignment: Boolean(data.required),
      count_assignment_id: countAssignments.length === 1 ? countAssignments[0].assignment_id : null,
      count_assignment_ambiguous: countAssignments.length > 1,
      requires_convert_assignment: Boolean(data.required),
      convert_assignment_id: convertAssignments.length === 1 ? convertAssignments[0].assignment_id : null,
      convert_assignment_ambiguous: convertAssignments.length > 1,
    };
  }

  async function handleSaveSetup(formData) {
    const normalizedLocation = (formData.location_id || assignedLocation?.location_id || "").trim();
    const selectedEventId = formData.event_id || (
      activeSetup?.location_id === normalizedLocation
      && activeSetup?.service_date === formData.service_date
      && activeSetup?.program_type === formData.program_type
        ? activeSetup.event_id
        : ""
    );
    let countAssignment;
    const eventOption = ["modal_event_id", "page_event_id"].map((id) => qs(`#${id}`)).find((el) => el?.value === selectedEventId)?.selectedOptions?.[0];
    const eventLocationId = eventOption?.dataset.locationId || normalizedLocation;
    try {
      countAssignment = await resolveEventAssignments(
        selectedEventId,
        eventLocationId,
      );
    } catch (error) {
      showToast(error.message, "warning");
      return false;
    }
    const identity = {
      program_domain: formData.program_domain,
      program_type: formData.program_type,
      program_level: formData.program_level,
      location_id: eventLocationId,
      assigned_location_id: assignedLocation?.location_id || normalizedLocation,
      location_label: assignedLocation?.formatted_id || assignedLocation?.location_name || "Assigned location",
      location_name: assignedLocation?.location_name || "",
      church_type: formData.church_type || assignedLocation?.church_type || "DCLM",
      service_date: formData.service_date || todayISO(),
      event_id: selectedEventId,
      requires_count_assignment: countAssignment.requires_count_assignment,
      count_assignment_id: countAssignment.count_assignment_id,
      count_assignment_ambiguous: countAssignment.count_assignment_ambiguous || false,
      requires_convert_assignment: countAssignment.requires_convert_assignment,
      convert_assignment_id: countAssignment.convert_assignment_id,
      convert_assignment_ambiguous: countAssignment.convert_assignment_ambiguous || false,
    };

    const draft = await DCLM_DB.getCountDraft();
    const draftContextChanged = draft && [
      "event_id", "location_id", "program_type", "program_domain", "program_level", "church_type", "service_date",
    ].some((field) => draft[field] !== identity[field]);
    if (draft && draftContextChanged && Object.values(draft.counts || {}).some((value) => Number(value) > 0)) {
      showToast("Finish or reset the current population tally before changing its event or location.", "warning");
      return false;
    }

    if (!identity.church_type || !identity.program_domain || !identity.program_type || !identity.program_level || !identity.location_id || !identity.service_date
        || (requiresScheduledEvent(identity) && !identity.event_id)) {
      showToast(requiresScheduledEvent(identity)
        ? "Crusade setup requires its scheduled event."
        : "Complete the church section, program, location, and service date.", "warning");
      haptic("warning");
      return false;
    }

    await DCLM_DB.saveActiveSetup(identity);
    showToast("Program ecclesiastical identity saved!", "success");
    haptic("success");

    // Fetch and cache location worker roster immediately
    fetchLocationRoster(identity.assigned_location_id || identity.location_id);

    await refreshActiveSetup();
    return true;
  }

  function initSetupBindings() {
    loadAssignedLocation();
    bindDomainTypeSync("modal_program_domain", "modal_program_type");
    bindDomainTypeSync("page_program_domain", "page_program_type");

    // Modal save
    const modalSaveBtn = qs("#btn-save-modal-setup");
    if (modalSaveBtn) {
      modalSaveBtn.addEventListener("click", async () => {
        const success = await handleSaveSetup({
          church_type: qs("#modal_church_type")?.value || assignedLocation?.church_type || "DCLM",
          program_domain: qs("#modal_program_domain")?.value,
          program_type: qs("#modal_program_type")?.value,
          program_level: qs("#modal_program_level")?.value,
          location_id: qs("#modal_location_id")?.value,
          service_date: qs("#modal_service_date")?.value,
          event_id: qs("#modal_event_id")?.value,
        });

        if (success) {
          const modalEl = qs("#setupModal");
          if (modalEl && typeof bootstrap !== "undefined") {
            const instance = bootstrap.Modal.getInstance(modalEl);
            if (instance) instance.hide();
          }
        }
      });
    }

    // Page save
    const pageSaveBtn = qs("#btn-save-page-setup");
    if (pageSaveBtn) {
      pageSaveBtn.addEventListener("click", async () => {
        const success = await handleSaveSetup({
          church_type: qs("#page_church_type")?.value || assignedLocation?.church_type || "DCLM",
          program_domain: qs("#page_program_domain")?.value,
          program_type: qs("#page_program_type")?.value,
          program_level: qs("#page_program_level")?.value,
          location_id: qs("#page_location_id")?.value,
          service_date: qs("#page_service_date")?.value,
          event_id: qs("#page_event_id")?.value,
        });

        if (success) {
          setTimeout(() => { window.location.href = "/"; }, 400);
        }
      });
    }

    // Populate modal inputs if setup already exists
    if (activeSetup) {
      if (qs("#modal_church_type")) qs("#modal_church_type").value = activeSetup.church_type || "";
      if (qs("#modal_program_domain")) {
        qs("#modal_program_domain").value = activeSetup.program_domain || "";
        qs("#modal_program_domain").dispatchEvent(new Event("change"));
      }
      if (qs("#modal_program_type")) qs("#modal_program_type").value = activeSetup.program_type || "";
      if (qs("#modal_program_level")) qs("#modal_program_level").value = activeSetup.program_level || "";
      if (qs("#modal_location_id")) qs("#modal_location_id").value = activeSetup.location_id || "";
      if (qs("#modal_location_label")) qs("#modal_location_label").value = activeSetup.location_label || assignedLocation?.formatted_id || "";
      if (qs("#modal_service_date")) qs("#modal_service_date").value = activeSetup.service_date || todayISO();
      if (qs("#modal_event_id")) qs("#modal_event_id").value = activeSetup.event_id || "";

      // Mirror for page setup
      if (qs("#page_church_type")) qs("#page_church_type").value = activeSetup.church_type || "";
      if (qs("#page_program_domain")) {
        qs("#page_program_domain").value = activeSetup.program_domain || "";
        qs("#page_program_domain").dispatchEvent(new Event("change"));
      }
      if (qs("#page_program_type")) qs("#page_program_type").value = activeSetup.program_type || "";
      if (qs("#page_program_level")) qs("#page_program_level").value = activeSetup.program_level || "";
      if (qs("#page_location_id")) qs("#page_location_id").value = activeSetup.location_id || "";
      if (qs("#page_location_label")) qs("#page_location_label").value = activeSetup.location_label || assignedLocation?.formatted_id || "";
      if (qs("#page_service_date")) qs("#page_service_date").value = activeSetup.service_date || todayISO();
      if (qs("#page_event_id")) qs("#page_event_id").value = activeSetup.event_id || "";
    } else {
      if (qs("#modal_service_date")) qs("#modal_service_date").value = todayISO();
      if (qs("#page_service_date")) qs("#page_service_date").value = todayISO();
    }
    for (const prefix of ["modal", "page"]) {
      for (const field of ["location_id", "service_date", "program_type"]) {
        qs(`#${prefix}_${field}`)?.addEventListener("change", () => loadProgramEvents(prefix));
      }
    }
    if (activeSetup?.location_id) {
      loadProgramEvents("modal");
      loadProgramEvents("page");
    }
  }

  // -------------------------------------------------------------
  // Population Counter & Offering Engine
  // -------------------------------------------------------------
  function updateCounterDisplays() {
    let grandTotal = 0;
    Object.entries(counterState).forEach(([key, count]) => {
      grandTotal += count;
      const el = qs(`#count-display-${key}`);
      if (el) el.textContent = count.toLocaleString();

      const editInput = qs(`#edit_${key}`);
      if (editInput) editInput.value = count;
    });

    const totalEl = qs("#counter-grand-total");
    if (totalEl) totalEl.textContent = grandTotal.toLocaleString();
  }

  async function initCounterBindings() {
    const draft = await DCLM_DB.getCountDraft();
    if (draft && Object.values(draft.counts || {}).some((value) => Number(value) > 0)) {
      if (draft.setup && (eventContextKey(activeSetup) !== eventContextKey(draft.setup) || activeSetup?.location_id !== draft.location_id)) {
        activeSetup = draft.setup;
        await DCLM_DB.saveActiveSetup(draft.setup);
        await refreshActiveSetup();
        showToast("Restored the unfinished tally and its original event from this device.", "info");
      }
      counterState = { ...counterState, ...draft.counts };
      if (draft.setup && eventContextKey(draft.setup) === eventContextKey(activeSetup) && draft.location_id === activeSetup?.location_id) {
        showToast("Restored the unfinished tally from this device.", "info");
      }
    }
    qsa(".dclm-count-tile").forEach((tile) => {
      tile.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!activeSetup || !activeSetup.location_id || !activeSetup.service_date || !activeSetup.program_type
            || (requiresScheduledEvent() && !activeSetup.event_id)) {
          showToast(requiresScheduledEvent()
            ? "Select the scheduled crusade event before taking counts."
            : "Complete service setup before taking counts.", "warning");
          haptic("warning");
          return;
        }
        if (activeSetup.requires_count_assignment && !activeSetup.count_assignment_id) {
          showToast("This alpha crusade count requires your approved event count assignment. Contact the event administrator.", "warning");
          haptic("warning");
          return;
        }

        const category = tile.dataset.category;
        if (category && counterState[category] !== undefined) {
          counterState[category] += 1;
          updateCounterDisplays();
          await persistCountDraft();

          // Brief visual pulse on the tile number
          const numEl = tile.querySelector(".dclm-count-num");
          if (numEl) {
            numEl.classList.add("dclm-count-pulse");
            setTimeout(() => numEl.classList.remove("dclm-count-pulse"), 120);
          }

          const grandTotal = Object.values(counterState).reduce((a, b) => a + b, 0);
          if (grandTotal > 0 && grandTotal % 50 === 0) {
            haptic("milestone");
          } else {
            haptic("tick");
          }
        }
      });
    });

    // Reset button
    const resetBtn = qs("#btn-reset-counter");
    if (resetBtn) {
      resetBtn.addEventListener("click", async () => {
        if (confirm("Reset all population tallies to zero?")) {
          Object.keys(counterState).forEach((k) => { counterState[k] = 0; });
          await DCLM_DB.clearCountDraft();
          updateCounterDisplays();
          showToast("Tallies reset to 0.", "info");
          haptic("warning");
        }
      });
    }

    // Apply manual edits from modal
    const applyEditBtn = qs("#btn-apply-manual-counts");
    if (applyEditBtn) {
      applyEditBtn.addEventListener("click", async () => {
        Object.keys(counterState).forEach((key) => {
          const input = qs(`#edit_${key}`);
          if (input) {
            counterState[key] = Math.max(0, parseInt(input.value, 10) || 0);
          }
        });
        updateCounterDisplays();
        await persistCountDraft();
        showToast("Manual count adjustments applied.", "success");
        haptic("success");

        const modalEl = qs("#editCountsModal");
        if (modalEl && typeof bootstrap !== "undefined") {
          const instance = bootstrap.Modal.getInstance(modalEl);
          if (instance) instance.hide();
        }
      });
    }

    // Submit Tithe & Offering
    const offeringSubmitBtn = qs("#btn-submit-offering");
    if (offeringSubmitBtn) {
      offeringSubmitBtn.addEventListener("click", async () => {
        if (!activeSetup || !activeSetup.location_id || !activeSetup.service_date || !activeSetup.program_type
            || (requiresScheduledEvent() && !activeSetup.event_id)) {
          showToast(requiresScheduledEvent()
            ? "Select the scheduled crusade event before recording offerings."
            : "Complete service setup before recording offerings.", "warning");
          haptic("warning");
          return;
        }

        const amountInput = qs("#offering-amount-input");
        const amount = (amountInput?.value || "").trim();
        const amountValue = Number(amount);
        if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(amount) || !Number.isFinite(amountValue)
            || amountValue <= 0 || amountValue > 9999999999.99) {
          showToast("Enter an amount greater than zero with no more than two decimal places.", "warning");
          haptic("warning");
          return;
        }

        const fundType = qs("#offering-fund-type")?.value || "offering";
        const paymentMethod = qs("#offering-payment-method")?.value || "cash";

        const item = {
          client_id: generateUUID(),
          location_id: activeSetup.location_id,
          event_id: activeSetup.event_id || null,
          amount: amount,
          fund_type: fundType,
          payment_method: paymentMethod,
          recorded_at: new Date().toISOString(),
          church_type: activeSetup.church_type,
          program_domain: activeSetup.program_domain,
          program_type: activeSetup.program_type,
          service_date: activeSetup.service_date,
        };

        await DCLM_DB.addToQueue("offerings_queue", item);
        await refreshHomeQueueSummary();
        showToast(`Entry of â‚¦${amountValue.toLocaleString()} queued offline.`, "success");
        haptic("success");
        if (amountInput) amountInput.value = "";
      });
    }

    // Save & Queue Count Batch
    const finalizeCountBtn = qs("#btn-finalize-count-batch");
    if (finalizeCountBtn) {
      finalizeCountBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!activeSetup || !activeSetup.location_id || !activeSetup.service_date || !activeSetup.program_type
            || (requiresScheduledEvent() && !activeSetup.event_id)) {
          showToast(requiresScheduledEvent()
            ? "Select the scheduled crusade event before saving counts."
            : "Complete service setup before saving counts.", "warning");
          haptic("warning");
          return;
        }
        if (activeSetup.requires_count_assignment && !activeSetup.count_assignment_id) {
          showToast("This alpha crusade count requires your approved event count assignment. Contact the event administrator.", "warning");
          haptic("warning");
          return;
        }

        const total = Object.values(counterState).reduce((a, b) => a + b, 0);
        if (total === 0) {
          showToast("Cannot queue an empty headcount of zero.", "warning");
          haptic("warning");
          return;
        }

        const batch = {
          client_id: generateUUID(),
          location_id: activeSetup.location_id,
          event_id: activeSetup.event_id || null,
          assignment_id: activeSetup.count_assignment_id || null,
          adult_male: counterState.adult_male,
          adult_female: counterState.adult_female,
          youth_male: counterState.youth_male,
          youth_female: counterState.youth_female,
          boys: counterState.boys,
          girls: counterState.girls,
          total: total,
          captured_at: new Date().toISOString(),
          church_type: activeSetup.church_type,
          program_domain: activeSetup.program_domain,
          program_type: activeSetup.program_type,
          service_date: activeSetup.service_date,
        };

        await DCLM_DB.addToQueue("counts_queue", batch);
        await refreshHomeQueueSummary();
        await DCLM_DB.clearCountDraft();
        showToast(`Batch of ${total.toLocaleString()} souls queued for sync!`, "success");
        haptic("success");

        // Optional: clear active tallies after successful queue
        Object.keys(counterState).forEach((k) => { counterState[k] = 0; });
        updateCounterDisplays();
      });
    }
  }

  // -------------------------------------------------------------
  // Workers Attendance Engine
  // -------------------------------------------------------------
  async function fetchLocationRoster(locationId) {
    if (!locationId) return;

    const cached = await DCLM_DB.getWorkerRoster(locationId, eventContextKey());
    const submittedWorkers = await DCLM_DB.getAttendanceSubmittedWorkerIds(eventContextKey());
    cachedRoster = cached.map((worker) => ({ ...worker, attendance_submitted: submittedWorkers.has(String(worker.worker_id)) }));
    rosterState = cached.length ? "stale" : "loading";
    renderWorkerRoster();
    if (!navigator.onLine) {
      rosterState = cached.length ? "offline" : "error";
      const lastUpdated = cached[0]?.cached_at;
      showToast(cached.length
        ? `Offline: showing the saved roster${lastUpdated ? ` from ${new Date(lastUpdated).toLocaleString()}` : ""}.`
        : "Offline and no saved roster is available for this location.", "warning");
      renderWorkerRoster();
      return;
    }

    try {
      showToast(cached.length ? "Refreshing the saved roster; it may be out of date." : "Fetching location worker roster...", "info");
      const resp = await window.DCLM_AUTH.apiFetch(`/api/workers?location_id=${encodeURIComponent(locationId)}`);
      const data = await resp.json();

      if (!resp.ok) throw new Error(data.error || "Could not load the worker roster.");

      if (data.ok && Array.isArray(data.items)) {
        cachedRoster = data.items.map((worker) => ({
          ...worker,
          marked_present: false,
          attendance_submitted: submittedWorkers.has(String(worker.worker_id)),
        }));
        await DCLM_DB.saveWorkerRoster(cachedRoster, locationId);
        rosterState = cachedRoster.length ? "fresh" : "empty";
        showToast(cachedRoster.length
          ? `Roster refreshed: ${cachedRoster.length} workers for ${locationId}.`
          : "No approved workers were returned for this location.", cachedRoster.length ? "success" : "info");
        renderWorkerRoster();
      }
    } catch (err) {
      console.warn("Could not fetch remote roster:", err);
      cachedRoster = (await DCLM_DB.getWorkerRoster(locationId, eventContextKey()))
        .map((worker) => ({ ...worker, attendance_submitted: submittedWorkers.has(String(worker.worker_id)) }));
      rosterState = cachedRoster.length ? "stale" : "error";
      const lastUpdated = cachedRoster[0]?.cached_at;
      showToast(cachedRoster.length
        ? `Roster refresh failed. Showing saved data${lastUpdated ? ` from ${new Date(lastUpdated).toLocaleString()}` : ""}; it may be out of date.`
        : `Could not load a roster: ${err.message}`, "warning");
      renderWorkerRoster();
    }
  }

  function renderWorkerRoster() {
    const listEl = qs("#worker-roster-list");
    const emptyEl = qs("#attendance-empty-state");
    const totalCountEl = qs("#roster-total-count");
    const markedCountEl = qs("#roster-marked-count");

    if (!listEl) return;

    const query = (qs("#worker-search-input")?.value || "").trim().toLowerCase();
    const filtered = cachedRoster.filter((w) => {
      if (!query) return true;
      const haystack = `${w.name} ${w.phone} ${w.unit || ""}`.toLowerCase();
      return haystack.includes(query);
    });

    const markedTotal = cachedRoster.filter((w) => w.marked_present).length;
    if (totalCountEl) totalCountEl.textContent = cachedRoster.length;
    if (markedCountEl) markedCountEl.textContent = markedTotal;

    if (emptyEl) {
      emptyEl.classList.toggle("d-none", filtered.length > 0);
      if (filtered.length === 0) {
        emptyEl.textContent = query
          ? "No workers match this search."
          : rosterState === "loading"
            ? "Loading the approved worker rosterâ€¦"
            : rosterState === "error"
              ? "Roster unavailable. Check your connection and access, then refresh."
              : rosterState === "empty"
                ? "No approved workers were returned for this location. Contact your administrator if this is unexpected."
                : activeSetup?.location_id
                  ? "No workers are available in the approved roster for this location. Refresh or contact your administrator."
                  : "Configure your location setup to load workers for this service.";
      }
    }

    listEl.innerHTML = "";
    filtered.forEach((worker) => {
      const card = document.createElement("div");
      card.className = `dclm-worker-card ${worker.marked_present ? "is-marked" : ""} ${worker.attendance_submitted ? "is-submitted" : ""}`;
      card.innerHTML = `
        <div class="d-flex align-items-center gap-3">
          <div class="rounded-circle bg-primary-subtle text-primary fw-bold d-flex align-items-center justify-content-center" style="width: 44px; height: 44px; font-size: 0.95rem;">
            ${escapeHTML((worker.name || "W").split(" ").map(p => p[0]).slice(0, 2).join(""))}
          </div>
          <div>
            <div class="fw-bold text-dark mb-0">${escapeHTML(worker.name)}</div>
            <div class="small text-muted">${escapeHTML(worker.phone)} â€¢ ${escapeHTML(worker.unit || "General Worker")}</div>
          </div>
        </div>
        <button type="button" class="dclm-check-btn ${worker.marked_present || worker.attendance_submitted ? "is-checked" : ""}" ${worker.attendance_submitted ? "disabled" : ""} aria-label="${worker.attendance_submitted ? "Attendance submitted" : "Toggle attendance"}">
          ${worker.attendance_submitted ? "Submitted" : '<i class="bi bi-check-lg"></i>'}
        </button>
      `;
      card.querySelector(".dclm-check-btn").dataset.workerId = worker.worker_id;

      card.querySelector(".dclm-check-btn").addEventListener("click", async () => {
        const nextState = !worker.marked_present;
        worker.marked_present = nextState;
        await DCLM_DB.updateWorkerCheck(worker.worker_id, nextState, eventContextKey());
        renderWorkerRoster();
        haptic("tick");
        showToast(nextState ? `${worker.name} marked Present` : `${worker.name} unmarked`, nextState ? "success" : "info");
      });

      listEl.appendChild(card);
    });
  }

  function renderAttendanceReview() {
    const presentListEl = qs("#review-marked-list");
    const presentCountEl = qs("#review-present-count");
    const rosterCountEl = qs("#review-roster-count");
    const scopeEl = qs("#review-setup-scope");

    if (!presentListEl) return;

    DCLM_DB.getWorkerRoster(activeSetup?.location_id || "", eventContextKey()).then((roster) => {
      const marked = roster.filter((w) => w.marked_present);
      if (presentCountEl) presentCountEl.textContent = `${marked.length} Workers`;
      if (rosterCountEl) rosterCountEl.textContent = `${roster.length} Total Registered`;
      if (scopeEl && activeSetup) {
        scopeEl.textContent = `${activeSetup.location_id} (${activeSetup.program_type})`;
      }

      if (marked.length === 0) {
        presentListEl.innerHTML = '<div class="text-muted text-center py-4 small">No workers marked present yet.</div>';
        return;
      }

      presentListEl.replaceChildren();
      for (const worker of marked) {
        const row = document.createElement("div");
        row.className = "d-flex justify-content-between align-items-center p-2 bg-white rounded-3 border";
        const info = document.createElement("div");
        const name = document.createElement("div");
        name.className = "fw-bold text-dark small";
        name.textContent = worker.name || "Church Worker";
        const details = document.createElement("div");
        details.className = "text-muted";
        details.style.fontSize = "0.75rem";
        details.textContent = `${worker.phone || ""} ? ${worker.unit || "Worker"}`;
        info.append(name, details);
        const badge = document.createElement("span");
        badge.className = "badge bg-success-subtle text-success rounded-pill px-3 py-1 small";
        badge.textContent = "Present";
        row.append(info, badge);
        presentListEl.appendChild(row);
      }
    });

    const approveBtn = qs("#btn-approve-attendance-batch");
    if (approveBtn) {
      approveBtn.addEventListener("click", async () => {
        if (!activeSetup?.location_id || !activeSetup?.service_date || !activeSetup?.program_type
            || (requiresScheduledEvent() && !activeSetup.event_id)) {
          showToast(requiresScheduledEvent()
            ? "Select the scheduled crusade event before reviewing attendance."
            : "Complete service setup before reviewing attendance.", "warning");
          return;
        }
        const contextKey = eventContextKey();
        const roster = await DCLM_DB.getWorkerRoster(activeSetup.location_id, contextKey);
        const marked = roster.filter((w) => w.marked_present);

        if (marked.length === 0) {
          showToast("No workers marked present to submit.", "warning");
          haptic("warning");
          return;
        }

        const submittedWorkers = await DCLM_DB.getAttendanceSubmittedWorkerIds(contextKey);
        let queuedCount = 0;
        for (const worker of marked) {
          if (submittedWorkers.has(String(worker.worker_id))) continue;
          const item = {
            client_id: generateUUID(),
            location_id: activeSetup?.location_id || worker.location_id,
            event_id: activeSetup?.event_id || null,
            context_key: contextKey,
            church_type: activeSetup.church_type,
            program_domain: activeSetup.program_domain,
            program_type: activeSetup.program_type,
            service_date: activeSetup.service_date,
            worker_id: worker.worker_id,
            status: "present",
            recorded_at: new Date().toISOString(),
          };
          await DCLM_DB.addToQueue("attendance_queue", item);
          queuedCount += 1;
        }

        if (!queuedCount) {
          showToast("These workers already have attendance records queued or confirmed for this event.", "info");
          return;
        }
        await refreshHomeQueueSummary();
        showToast(`Attendance for ${queuedCount} worker(s) queued for this event.`, "success");
        haptic("success");

        setTimeout(() => { window.location.href = "/queues"; }, 500);
      });
    }
  }

  function initAttendanceBindings() {
    const searchInput = qs("#worker-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", renderWorkerRoster);
    }

    const refreshRosterBtn = qs("#btn-refresh-worker-roster");
    if (refreshRosterBtn && activeSetup) {
      refreshRosterBtn.addEventListener("click", () => {
        fetchLocationRoster(activeSetup.location_id);
      });
    }

    if (activeScreen === "fellowship") {
      // Fellowship reports use their own authorized fellowship ID and date.
    } else if (activeSetup && activeSetup.location_id) {
      fetchLocationRoster(activeSetup.location_id);
    }
  }

  // -------------------------------------------------------------
  // Converts & Newcomer Registration Engine
  // -------------------------------------------------------------
  function initRegistrationBindings() {
    const convertBtn = qs("#toggle-btn-convert");
    const newcomerBtn = qs("#toggle-btn-newcomer");
    const recordTypeInput = qs("#reg_record_type");

    if (convertBtn && newcomerBtn) {
      convertBtn.addEventListener("click", () => {
        convertBtn.className = "btn btn-primary w-100 rounded-pill py-2 fw-semibold";
        newcomerBtn.className = "btn btn-outline-secondary w-100 rounded-pill py-2 fw-semibold";
        if (recordTypeInput) recordTypeInput.value = "convert";
      });

      newcomerBtn.addEventListener("click", () => {
        newcomerBtn.className = "btn btn-primary w-100 rounded-pill py-2 fw-semibold";
        convertBtn.className = "btn btn-outline-secondary w-100 rounded-pill py-2 fw-semibold";
        if (recordTypeInput) recordTypeInput.value = "newcomer";
      });
    }

    const regSubmitBtn = qs("#btn-submit-registration");
    if (regSubmitBtn) {
      regSubmitBtn.addEventListener("click", async () => {
        if (!activeSetup || !activeSetup.location_id || !activeSetup.service_date || !activeSetup.program_type
            || (requiresScheduledEvent() && !activeSetup.event_id)) {
          showToast(requiresScheduledEvent()
            ? "Select the scheduled crusade event before registering members."
            : "Complete service setup before registering members.", "warning");
          haptic("warning");
          return;
        }
        if (recordTypeInput?.value === "convert" && activeSetup.requires_convert_assignment && !activeSetup.convert_assignment_id) {
          showToast(activeSetup.convert_assignment_ambiguous
            ? "Multiple approved convert assignments are linked to this worker. Ask the event administrator to resolve them."
            : "Alpha crusade converts require your approved convert assignment. Contact the event administrator.", "warning");
          return;
        }

        const name = qs("#reg_full_name")?.value.trim();
        const gender = qs("#reg_gender")?.value;
        const phoneRaw = qs("#reg_phone")?.value.trim() || "";
        const phone = phoneRaw.replace(/[\s()-]/g, "");

        if (!name || !gender || !phone) {
          showToast("Name, gender, and phone number are required fields.", "warning");
          haptic("warning");
          return;
        }
        if (name.length > 120 || !/^\+?\d{7,15}$/.test(phone)) {
          showToast("Use a name up to 120 characters and a phone number with 7â€“15 digits.", "warning");
          haptic("warning");
          return;
        }
        const optionalValues = {
          address: qs("#reg_address")?.value.trim() || "",
          profession: qs("#reg_profession")?.value.trim() || "",
          work_address: qs("#reg_work_address")?.value.trim() || "",
          class_level: qs("#reg_class_level")?.value.trim() || "",
          invited_by: qs("#reg_invited_by")?.value.trim() || "",
        };
        const detailLimits = { address: 300, profession: 120, work_address: 300, class_level: 60, invited_by: 120 };
        if (Object.entries(detailLimits).some(([key, limit]) => optionalValues[key].length > limit)) {
          showToast("One of the optional follow-up fields exceeds its allowed length.", "warning");
          return;
        }

        const record = {
          client_id: generateUUID(),
          location_id: activeSetup.location_id,
          event_id: activeSetup.event_id || null,
          record_type: recordTypeInput?.value || "convert",
          assignment_id: recordTypeInput?.value === "convert" ? activeSetup.convert_assignment_id || null : null,
          name: name,
          gender: gender,
          phone: phone,
          details: {
            address: optionalValues.address,
            marital_status: qs("#reg_marital_status")?.value || "",
            social_status: qs("#reg_social_status")?.value || "",
            profession: optionalValues.profession,
            work_address: optionalValues.work_address,
            class_level: optionalValues.class_level,
            invited_by: optionalValues.invited_by,
            salvation_type: qs("#reg_salvation_type")?.value || "",
          },
          church_type: activeSetup.church_type,
          program_domain: activeSetup.program_domain,
          program_type: activeSetup.program_type,
          service_date: activeSetup.service_date,
          captured_at: new Date().toISOString(),
        };

        regSubmitBtn.disabled = true;
        try {
          await DCLM_DB.addToQueue("registration_queue", record);
          showToast(`Saved ${name} on this device. It is waiting to sync.`, "success");
          await refreshHomeQueueSummary();
          haptic("success");
          qs("#registration-entry-form")?.reset();
          if (recordTypeInput) recordTypeInput.value = "convert";
          if (convertBtn && newcomerBtn) {
            convertBtn.className = "btn btn-primary w-100 rounded-pill py-2 fw-semibold";
            newcomerBtn.className = "btn btn-outline-secondary w-100 rounded-pill py-2 fw-semibold";
          }
        } catch (error) {
          showToast(`Could not save this registration: ${error.message}`, "danger");
        } finally {
          regSubmitBtn.disabled = false;
        }
      });
    }
  }

  function initFellowshipBindings() {
    const select = qs("#fellowship_id");
    const groupSelect = qs("#fellowship_group");
    const today = todayISO();
    for (const id of ["fellowship_attendance_date", "fellowship_offering_date"]) {
      const input = qs(`#${id}`);
      if (input && !input.value) input.value = today;
    }
    const show = (items) => {
      assignedFellowships = items || [];
      if (select) {
        select.replaceChildren(new Option(items.length ? "Choose your house fellowship" : "No fellowship is assigned to this location", ""));
        for (const fellowship of items) {
          select.add(new Option(`${fellowship.name}${fellowship.code ? ` Â· ${fellowship.code}` : ""}`, fellowship.fellowship_id));
        }
      }
      const wrap = qs("#fellowship-content-wrap");
      if (wrap) wrap.classList.remove("d-none");
      if (activeScreen === "fellowship" && qs("#identity-bar-title")) {
        qs("#identity-bar-title").textContent = assignedLocation?.location_name || "Home Fellowship";
      }
    };
    const load = async () => {
      if (!navigator.onLine) {
        const cached = await DCLM_DB.getFellowshipContext();
        if (cached?.items?.length) {
          assignedLocation = cached.location;
          show(cached.items);
          showToast("Offline: using the last authorized fellowship list saved on this account.", "warning");
        }
        else showToast("Connect once to load the assigned fellowship list.", "warning");
        return;
      }
      try {
        const response = await window.DCLM_AUTH.apiFetch("/api/fellowship-context");
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || "Could not load fellowships.");
        assignedLocation = data.location;
        await DCLM_DB.saveFellowshipContext({ location: data.location, items: data.items || [] });
        show(data.items || []);
      } catch (error) { showToast(error.message, "warning"); }
    };
    load();

    const selected = () => assignedFellowships.find((item) => item.fellowship_id === select?.value);
    const save = async (store, extra) => {
      const fellowship = selected();
      if (!fellowship) { showToast("Choose an assigned house fellowship first.", "warning"); return; }
      await DCLM_DB.addToQueue(store, {
        client_id: generateUUID(), fellowship_id: fellowship.fellowship_id, fellowship_name: fellowship.name,
        location_id: assignedLocation?.location_id || window.DCLM_CURRENT_USER?.location_id || "",
        ...extra,
      });
      showToast("Saved on this device. It is waiting to sync.", "success");
      await refreshHomeQueueSummary();
      renderQueuesView();
    };

    qs("#btn-save-fellowship-attendance")?.addEventListener("click", async () => {
      const values = Object.fromEntries(["men", "women", "youths", "children"].map((key) => [key, qs(`#fellowship_${key}`)?.value || "0"]));
      if (Object.values(values).some((value) => !/^\d{1,6}$/.test(value))) { showToast("Attendance categories must be whole numbers from 0 to 999999.", "warning"); return; }
      const date = qs("#fellowship_attendance_date")?.value;
      if (!date) { showToast("Choose the meeting date.", "warning"); return; }
      await save("fellowship_attendance_queue", { ...values, date, topic: qs("#fellowship_topic")?.value.trim() || null });
    });
    qs("#btn-save-fellowship-offering")?.addEventListener("click", async () => {
      const amount = qs("#fellowship_offering_amount")?.value.trim() || "";
      const date = qs("#fellowship_offering_date")?.value;
      if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) { showToast("Enter a positive amount with up to two decimal places.", "warning"); return; }
      if (!date) { showToast("Choose the meeting date.", "warning"); return; }
      await save("fellowship_offerings_queue", { amount, date, note: qs("#fellowship_offering_note")?.value.trim() || null });
      qs("#fellowship_offering_amount").value = "";
    });
    qs("#btn-save-fellowship-member")?.addEventListener("click", async () => {
      const name = qs("#fellowship_member_name")?.value.trim() || "";
      const phone = qs("#fellowship_member_phone")?.value.trim() || "";
      const address = qs("#fellowship_member_address")?.value.trim() || "";
      const fellowshipGroup = groupSelect?.value || "";
      if (!name || name.length > 120 || phone.length > 30 || !address || address.length > 300 || !fellowshipGroup) {
        showToast("Enter the member name, fellowship group, home address (up to 300 characters), and phone up to 30 characters.", "warning");
        return;
      }
      await save("fellowship_members_queue", { name, phone: phone || null, address, fellowship_group: fellowshipGroup });
      qs("#fellowship_member_name").value = "";
      qs("#fellowship_member_phone").value = "";
      qs("#fellowship_member_address").value = "";
    });
  }

  // -------------------------------------------------------------
  // Queue & Sync View Manager
  // -------------------------------------------------------------
  async function renderQueuesView() {
    const listEl = qs("#pending-queue-list");
    const emptyEl = qs("#pending-queue-empty");
    const badgeEl = qs("#pending-queue-badge");

    if (!listEl) return;

    const legacyCount = await DCLM_DB.getUnassignedQueueCount();
    const legacyNotice = qs("#legacy-queue-notice");
    const legacyMessage = qs("#legacy-queue-message");
    if (legacyNotice) legacyNotice.classList.toggle("d-none", legacyCount === 0);
    if (legacyMessage && legacyCount) legacyMessage.textContent = `${legacyCount} older saved record(s) have no account owner. Claiming assigns them to your signed-in account.`;

    const counts = await DCLM_DB.getAllFromQueue("counts_queue");
    const offerings = await DCLM_DB.getAllFromQueue("offerings_queue");
    const attendance = await DCLM_DB.getAllFromQueue("attendance_queue");
    const registrations = await DCLM_DB.getAllFromQueue("registration_queue");
    const fellowshipMembers = await DCLM_DB.getAllFromQueue("fellowship_members_queue");
    const fellowshipAttendance = await DCLM_DB.getAllFromQueue("fellowship_attendance_queue");
    const fellowshipOfferings = await DCLM_DB.getAllFromQueue("fellowship_offerings_queue");

    const totalBatches = counts.length + offerings.length + (attendance.length > 0 ? 1 : 0) + registrations.length
      + fellowshipMembers.length + fellowshipAttendance.length + fellowshipOfferings.length;
    if (badgeEl) badgeEl.textContent = `${totalBatches} Pending`;

    if (totalBatches === 0) {
      if (emptyEl) emptyEl.classList.remove("d-none");
      listEl.innerHTML = "";
    } else {
      if (emptyEl) emptyEl.classList.add("d-none");
      let html = "";

      counts.forEach((item) => {
        html += `
          <div class="dclm-queue-item type-count">
            <div>
              <div class="fw-bold text-dark small"><i class="bi bi-people-fill text-primary me-1"></i> Population Count (${Number(item.total || 0).toLocaleString()} Souls)</div>
              <div class="small text-muted">${escapeHTML(item.location_id)} â€¢ ${escapeHTML(item.service_date)}</div>
              ${item.last_error ? `<div class="small text-danger mt-1">Sync issue: ${escapeHTML(item.last_error)}</div>` : ""}
            </div>
          <button class="btn btn-sm btn-outline-danger rounded-pill px-3" data-discard-store="counts_queue" data-discard-id="${escapeHTML(item.client_id)}">Discard</button>
          </div>
        `;
      });

      offerings.forEach((item) => {
        html += `
          <div class="dclm-queue-item type-offering">
            <div>
              <div class="fw-bold text-dark small"><i class="bi bi-wallet2 text-success me-1"></i> Offering / Tithe (â‚¦${Number(item.amount).toLocaleString()})</div>
              <div class="small text-muted">${escapeHTML(item.fund_type)} via ${escapeHTML(item.payment_method)}</div>
              ${item.last_error ? `<div class="small text-danger mt-1">Sync issue: ${escapeHTML(item.last_error)}</div>` : ""}
            </div>
          <button class="btn btn-sm btn-outline-danger rounded-pill px-3" data-discard-store="offerings_queue" data-discard-id="${escapeHTML(item.client_id)}">Discard</button>
          </div>
        `;
      });

      if (attendance.length > 0) {
        html += `
          <div class="dclm-queue-item type-attendance">
            <div>
              <div class="fw-bold text-dark small"><i class="bi bi-person-check-fill text-info me-1"></i> Workers Attendance (${attendance.length} Workers)</div>
              <div class="small text-muted">Awaiting cloud confirmation</div>
              ${attendance.some((item) => item.last_error) ? `<div class="small text-danger mt-1">${attendance.filter((item) => item.last_error).length} attendance record(s) need attention; they remain saved.</div>` : ""}
            </div>
            <button class="btn btn-sm btn-outline-danger rounded-pill px-3" data-discard-attendance>Discard</button>
          </div>
        `;
      }

      registrations.forEach((item) => {
        html += `
          <div class="dclm-queue-item type-register">
            <div>
              <div class="fw-bold text-dark small"><i class="bi bi-person-plus-fill text-warning me-1"></i> ${item.record_type === "convert" ? "Convert" : "Guest"}: ${escapeHTML(item.name)}</div>
              <div class="small text-muted">${escapeHTML(item.phone)} â€¢ ${escapeHTML(item.details?.salvation_type || "Follow-up")}</div>
              ${item.last_error ? `<div class="small text-danger mt-1">Sync issue: ${escapeHTML(item.last_error)}</div>` : ""}
            </div>
            <button class="btn btn-sm btn-outline-danger rounded-pill px-3" data-discard-store="registration_queue" data-discard-id="${escapeHTML(item.client_id)}">Discard</button>
          </div>
        `;
      });

      const fellowshipQueues = [
        [fellowshipAttendance, "Fellowship Attendance", "fellowship_attendance_queue"],
        [fellowshipOfferings, "Fellowship Offering", "fellowship_offerings_queue"],
        [fellowshipMembers, "Fellowship Member", "fellowship_members_queue"],
      ];
      for (const [items, label, store] of fellowshipQueues) {
        items.forEach((item) => {
          const detail = store === "fellowship_attendance_queue"
            ? `${Number(item.men) + Number(item.women) + Number(item.youths) + Number(item.children)} people Â· ${item.date}`
            : store === "fellowship_offerings_queue" ? `â‚¦${Number(item.amount).toLocaleString()} Â· ${item.date}` : escapeHTML(item.name);
          html += `<div class="dclm-queue-item type-attendance"><div><div class="fw-bold text-dark small"><i class="bi bi-house-heart text-primary me-1"></i>${label}</div><div class="small text-muted">${escapeHTML(item.fellowship_name || "House Fellowship")} Â· ${detail}</div>${item.last_error ? `<div class="small text-danger mt-1">Sync issue: ${escapeHTML(item.last_error)}</div>` : ""}</div><button class="btn btn-sm btn-outline-danger rounded-pill px-3" data-discard-store="${store}" data-discard-id="${escapeHTML(item.client_id)}">Discard</button></div>`;
        });
      }

      listEl.innerHTML = html;
    }

    // Render Recent Synced History
    const recentListEl = qs("#recent-queue-list");
    const recentEmptyEl = qs("#recent-queue-empty");
    if (recentListEl) {
      const recent = await DCLM_DB.getAllFromQueue("recent_submissions");
      if (recent.length === 0) {
        if (recentEmptyEl) recentEmptyEl.classList.remove("d-none");
        recentListEl.innerHTML = "";
      } else {
        if (recentEmptyEl) recentEmptyEl.classList.add("d-none");
        recentListEl.innerHTML = recent.sort((a, b) => new Date(b.synced_at) - new Date(a.synced_at)).slice(0, 10).map((r) => `
          <div class="d-flex justify-content-between align-items-center p-2 mb-2 bg-white rounded-3 border">
            <div>
              <div class="fw-bold text-dark small">${escapeHTML(r.type || "Batch Record")}</div>
              <div class="text-muted" style="font-size: 0.75rem;">${new Date(r.synced_at).toLocaleTimeString()} â€¢ ${r.location_id || "Church"}</div>
            </div>
            <span class="badge bg-success text-white rounded-pill px-2 py-1 small">Synced</span>
          </div>
        `).join("");
      }
    }
  }

  function initQueuesBindings() {
    const listEl = qs("#pending-queue-list");
    listEl?.addEventListener("click", (event) => {
      const discard = event.target.closest("[data-discard-store]");
      if (discard) {
        window.DCLM_APP.discardQueueItem(discard.dataset.discardStore, discard.dataset.discardId);
      } else if (event.target.closest("[data-discard-attendance]")) {
        window.DCLM_APP.discardAllAttendance();
      }
    });

    const syncAllBtn = qs("#btn-sync-all-queues");
    if (syncAllBtn) {
      syncAllBtn.addEventListener("click", () => {
        DCLM_SYNC.syncAllQueues();
      });
    }

    qs("#btn-claim-legacy-queues")?.addEventListener("click", async () => {
      const count = await DCLM_DB.getUnassignedQueueCount();
      if (!count || !confirm(`Assign ${count} older saved record(s) to ${window.DCLM_CURRENT_USER?.name || "your account"}?`)) return;
      const claimed = await DCLM_DB.claimUnassignedQueueItems();
      showToast(`${claimed} older record(s) assigned to your account.`, "success");
      await renderQueuesView();
    });

    renderQueuesView();
  }

  // -------------------------------------------------------------
  // Settings Engine
  // -------------------------------------------------------------
  function initSettingsBindings() {
    const user = window.DCLM_CURRENT_USER || {};
    const userName = qs("#settings-user-name");
    const userEmail = qs("#settings-user-email");
    const userRole = qs("#settings-user-role");
    const userLocation = qs("#settings-user-location");
    if (userName) userName.textContent = user.name || "Field worker";
    if (userEmail) userEmail.textContent = user.email || "Not provided";
    if (userRole) userRole.textContent = (user.roles || []).join(", ") || "Field user";
    if (userLocation) userLocation.textContent = user.location_id || "Not assigned";
    updateNetworkStatus();

    // Clear worker roster cache
    const clearRosterBtn = qs("#btn-clear-roster-cache");
    if (clearRosterBtn) {
      clearRosterBtn.addEventListener("click", async () => {
        if (confirm("Clear the cached worker roster? It will be re-fetched on next attendance session.")) {
          await DCLM_DB.clearQueue("worker_roster");
          showToast("Worker roster cache cleared.", "success");
          haptic("success");
        }
      });
    }

    // Clear all offline data
    const clearAllBtn = qs("#btn-clear-all-data");
    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", async () => {
        if (confirm("Delete this account's setup, cached roster, recent history, and all pending records from this device? Pending records cannot be recovered after deletion.")) {
          const stores = ["active_setup", "worker_roster", "counts_queue", "offerings_queue",
                          "attendance_queue", "registration_queue", "fellowship_members_queue", "fellowship_attendance_queue",
                          "fellowship_offerings_queue", "recent_submissions", "count_draft",
                          "attendance_confirmed"];
          for (const store of stores) {
            await DCLM_DB.clearQueue(store);
          }
          await DCLM_DB.clearAuthState();
          showToast("This account's offline data was cleared.", "warning");
          haptic("warning");
          setTimeout(() => window.location.href = "/", 1500);
        }
      });
    }

    // Display last sync time from recent_submissions
    DCLM_DB.getAllFromQueue("recent_submissions").then((items) => {
      const lastSyncEl = qs("#settings-last-sync");
      if (lastSyncEl && items.length > 0) {
        const sorted = items.sort((a, b) => new Date(b.synced_at) - new Date(a.synced_at));
        lastSyncEl.textContent = new Date(sorted[0].synced_at).toLocaleString();
      }
    });
  }

  // -------------------------------------------------------------
  // Master Initialization
  // -------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", async () => {
    await window.DCLM_AUTH_READY;
    if (!window.DCLM_CURRENT_USER) return;
    updateNetworkStatus();
    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);

    await refreshActiveSetup();
    initSetupBindings();

    if (activeScreen === "counter") {
      await initCounterBindings();
      updateCounterDisplays();
    } else if (activeScreen === "attendance") {
      initAttendanceBindings();
      if (window.location.pathname.endsWith("/review")) {
        renderAttendanceReview();
      }
    } else if (activeScreen === "registration") {
      initRegistrationBindings();
    } else if (activeScreen === "fellowship") {
      initFellowshipBindings();
    } else if (activeScreen === "queues") {
      initQueuesBindings();
    } else if (activeScreen === "settings") {
      initSettingsBindings();
    }
    await refreshHomeQueueSummary();
  });

  return {
    showToast,
    refreshActiveSetup,
    refreshHomeQueueSummary,
    renderQueuesView,
    async discardQueueItem(storeName, key) {
      if (confirm("Discard this unsubmitted item?")) {
        await DCLM_DB.removeFromQueue(storeName, key);
        renderQueuesView();
        await refreshHomeQueueSummary();
        showToast("Item discarded.", "info");
      }
    },
    async discardAllAttendance() {
      if (confirm("Discard all unsubmitted attendance records?")) {
        await DCLM_DB.clearQueue("attendance_queue");
        renderQueuesView();
        await refreshHomeQueueSummary();
        showToast("Attendance queue cleared.", "info");
      }
    },
  };
})();
