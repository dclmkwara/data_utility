/**
 * DCLM Field Utility — Master Application Orchestrator
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
  let hapticsFailureNotified = false;
  let confirmResolver = null;

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

  function isWorkerAttendanceProgram(setup = activeSetup) {
    const domain = String(setup?.program_domain || "").toLowerCase();
    const type = String(setup?.program_type || "").toLowerCase();
    return ["weekly", "retreat", "conference"].includes(domain)
      && /worker|leader|leadership|overseer/.test(type);
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

  async function runButtonAction(button, busyLabel, action) {
    if (!button || button.disabled || button.dataset.busy === "true") return null;
    const originalHtml = button.innerHTML;
    const wasDisabled = button.disabled;
    button.disabled = true;
    button.dataset.busy = "true";
    button.setAttribute("aria-busy", "true");
    button.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span><span>${escapeHTML(busyLabel)}</span>`;
    try {
      return await action();
    } catch (error) {
      showToast(safeUiText(error?.message || "The request could not be completed. Please try again."), "danger");
      return null;
    } finally {
      button.innerHTML = originalHtml;
      button.disabled = wasDisabled;
      delete button.dataset.busy;
      button.removeAttribute("aria-busy");
    }
  }

  function haptic(effect) {
    if (window.__DCLM_HAPTICS_ENABLED__ === false) return false;
    if (typeof DCLM_HAPTICS !== "undefined" && typeof DCLM_HAPTICS[effect] === "function") {
      const result = DCLM_HAPTICS[effect]();
      if (result === true) return true;
      if (result === false) {
        if (typeof navigator.vibrate === "function" && !hapticsFailureNotified) {
          hapticsFailureNotified = true;
          setTimeout(() => showToast("Vibration is unavailable. Check device vibration settings and open this app in a supported browser.", "warning"), 0);
        }
        return false;
      }
    }
    if (typeof navigator.vibrate === "function") {
      const pattern = effect === "success" ? [25, 35, 25] : effect === "warning" ? [60, 30, 60] : effect === "tick" ? 12 : 22;
      const result = navigator.vibrate(pattern);
      if (result === false && !hapticsFailureNotified) {
        hapticsFailureNotified = true;
        setTimeout(() => showToast("Vibration is unavailable. Check device vibration settings and open this app in a supported browser.", "warning"), 0);
      }
      return result;
    }
    return false;
  }

  async function refreshHapticsSetting() {
    const toggle = qs("#setting-haptics-enabled");
    const message = qs("#settings-haptics-status");
    const enabled = await DCLM_DB.getHapticsEnabled();
    window.__DCLM_HAPTICS_ENABLED__ = enabled;
    if (toggle) toggle.checked = enabled;
    if (message) message.textContent = typeof navigator.vibrate === "function"
      ? (enabled ? "This browser supports vibration. Test it below; if there is no feedback, enable vibration in your device settings." : "Vibration is turned off. Enable it to get touch feedback.")
      : "This browser or device does not support vibration. Try the installed app on a supported Android device.";
    if (toggle) toggle.disabled = typeof navigator.vibrate !== "function";
    const testButton = qs("#btn-test-haptics");
    if (testButton) testButton.disabled = typeof navigator.vibrate !== "function";
  }

  function safeUiText(value) {
    let text = String(value ?? "");
    const extractMessage = (payload) => {
      if (typeof payload === "string") {
        const nestedStart = payload.search(/[\[{]/);
        if (nestedStart >= 0) {
          try { return extractMessage(JSON.parse(payload.slice(nestedStart))); } catch (_) { /* keep plain text */ }
        }
        return payload;
      }
      if (Array.isArray(payload)) return payload.map(extractMessage).filter(Boolean).join("; ");
      if (payload && typeof payload === "object") {
        for (const key of ["detail", "message", "msg", "error", "reason"]) {
          if (payload[key] !== undefined && payload[key] !== null) return extractMessage(payload[key]);
        }
      }
      return "The record could not be submitted. Please try again.";
    };
    const jsonStart = text.search(/[\[{]/);
    if (jsonStart >= 0) {
      try {
        const parsed = JSON.parse(text.slice(jsonStart));
        const details = parsed?.detail;
        const first = Array.isArray(details) ? details[0] : details;
        const location = Array.isArray(first?.loc) ? first.loc.join(".") : "";
        if (location.includes("worker_attendance") && location.endsWith("status")) {
          text = "Worker attendance was rejected because its status was invalid. The record is still saved; sync it again after reloading the app.";
        } else {
          text = extractMessage(parsed);
        }
      } catch (_) {
        if (text.trimStart().startsWith("{") || text.trimStart().startsWith("[")) {
          text = "The record could not be submitted. Please try again.";
        }
      }
    }
    if (text === "[object Object]") text = "The request could not be completed. Please try again.";
    text = text
      .replace(/Church_server/gi, "church records service")
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "record ID")
      .replace(/\s+/g, " ").trim();
    return text.length > 320 ? `${text.slice(0, 317)}...` : text;
  }

  function escapeHTML(value) {
    return safeUiText(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
  }

  function displayLocationId(locationId) {
    const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
    const readable = (...values) => values.find((value) => value && !isUuid(value));
    if (assignedLocation?.location_id && String(locationId) === String(assignedLocation.location_id)) {
      return safeUiText(readable(assignedLocation.formatted_id, assignedLocation.location_name) || "Location ID unavailable");
    }
    if (activeSetup?.location_id && String(locationId) === String(activeSetup.location_id)) {
      return safeUiText(readable(assignedLocation?.formatted_id, activeSetup.location_label) || "Location ID unavailable");
    }
    return "Location ID unavailable";
  }

  function showToast(message, type = "info") {
    const container = qs("#dclm-toast-container");
    if (!container) return;

    container.className = `dclm-toast dclm-toast--${type} is-visible`;
    container.textContent = safeUiText(message);

    clearTimeout(container._timer);
    container._timer = setTimeout(() => {
      container.classList.remove("is-visible");
    }, 3200);
  }

  function confirm(message, { title = "Please confirm", confirmLabel = "Continue", danger = false } = {}) {
    const modalEl = qs("#dclmConfirmModal");
    if (!modalEl || typeof bootstrap === "undefined") {
      showToast("The confirmation dialog is unavailable. Reload the page and try again.", "warning");
      return Promise.resolve(false);
    }
    qs("#dclm-confirm-message").textContent = safeUiText(message);
    modalEl.querySelector(".modal-title").textContent = title;
    const accept = qs("#dclm-confirm-accept");
    accept.textContent = confirmLabel;
    accept.className = `btn ${danger ? "btn-danger" : "btn-primary"} rounded-pill px-4 fw-semibold`;
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    return new Promise((resolve) => {
      if (confirmResolver) confirmResolver(false);
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        confirmResolver = null;
        modalEl.removeEventListener("hidden.bs.modal", onHidden);
        resolve(value);
      };
      const onHidden = () => finish(false);
      confirmResolver = (value) => finish(value);
      modalEl.addEventListener("hidden.bs.modal", onHidden, { once: true });
      accept.onclick = () => { finish(true); modal.hide(); };
      modal.show();
    });
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
      if (barEl) barEl.classList.add("d-none");
      if (shieldEl) shieldEl.classList.add("d-none");
      qsa("[id$='-content-wrap']").forEach((el) => el.classList.remove("d-none"));
    } else if (activeSetup && activeSetup.location_id && activeSetup.service_date && activeSetup.program_type) {
      if (barEl) {
        barEl.className = "dclm-identity-bar is-active";
      }
      if (iconEl) {
        iconEl.className = "dclm-identity-logo me-2";
      }
      const locationLabel = activeSetup.reporting_scope_code
        ? safeUiText(activeSetup.reporting_scope_code)
        : displayLocationId(activeSetup.assigned_location_id || activeSetup.location_id);
      if (titleEl) titleEl.textContent = safeUiText(activeSetup.event_title || activeSetup.program_type || "Church program");
      if (subEl) subEl.textContent = locationLabel;
      if (btnEl) btnEl.textContent = "Change";
      if (shieldEl) shieldEl.classList.add("d-none");
      // Show all content wraps now that setup is active
      qsa("[id$='-content-wrap']").forEach((el) => el.classList.remove("d-none"));
    } else {
      if (barEl) barEl.classList.remove("d-none");
      if (barEl) {
        barEl.className = "dclm-identity-bar is-missing";
      }
      if (iconEl) {
        iconEl.className = "dclm-identity-logo me-2";
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

  function reportingScopeLevel(scope) {
    return ({ local: "Local", location: "Local", group: "Group", region: "Region", state: "State" })[String(scope || "").toLowerCase()] || "";
  }

  function reportingScopeCodeFromPath(path) {
    const normalized = String(path || "").trim().replace(/^org\./i, "").replace(/\./g, "-");
    if (!normalized) return "";
    return normalized.toUpperCase().startsWith("DCL-") ? normalized.toUpperCase() : `DCL-${normalized.toUpperCase()}`;
  }

  function syncReportingScopeFromEvent(prefix) {
    const eventSelect = qs(`#${prefix}_event_id`);
    const levelSelect = qs(`#${prefix}_program_level`);
    const scopeInput = qs(`#${prefix}_reporting_scope_code`);
    if (!eventSelect || !levelSelect || !scopeInput) return;
    const option = eventSelect.selectedOptions?.[0];
    if (eventSelect.value && option?.dataset.reportingScopeCode) {
      const eventLevel = reportingScopeLevel(option.dataset.reportingScope);
      if (eventLevel && Array.from(levelSelect.options).some((item) => item.value === eventLevel)) {
        levelSelect.value = eventLevel;
      }
      scopeInput.value = option.dataset.reportingScopeCode;
      return;
    }
    levelSelect.value = "Local";
    scopeInput.value = assignedLocation?.formatted_id || "";
  }

  async function loadAssignedLocation() {
    const apply = (location) => {
      assignedLocation = location || null;
      for (const prefix of ["page", "modal"]) {
        const id = qs(`#${prefix}_location_id`);
        const label = qs(`#${prefix}_location_label`);
        const level = qs(`#${prefix}_program_level`);
        const scopeCode = qs(`#${prefix}_reporting_scope_code`);
        if (id) id.value = location?.location_id || "";
        if (label) label.value = location ? `${location.location_name} · ${location.formatted_id}` : "Location unavailable";
        if (level) level.value = "Local";
        if (scopeCode && !activeSetup?.event_id) scopeCode.value = location?.formatted_id || "";
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
      try {
        await applyActiveAssignedEvent(data.location);
      } catch (assignmentError) {
        showToast(assignmentError.message || "Assigned program setup could not be refreshed.", "warning");
      }
      await refreshActiveSetup();
      if (activeScreen === "attendance") {
        updateAttendanceSetupGate();
        if (window.location.pathname.endsWith("/review")) renderAttendanceReview();
      }
      const settingsLocation = qs("#settings-user-location");
      if (settingsLocation) settingsLocation.textContent = displayLocationId(data.location.location_id);
    } catch (error) {
      apply(null);
      showToast(error.message || "Could not load your assigned location.", "warning");
    }
  }

  async function applyActiveAssignedEvent(location) {
    if (!navigator.onLine || !location?.location_id) return;
    const response = await window.DCLM_AUTH.apiFetch("/api/events/assigned-to-me");
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Could not load your assigned program setup.");
    const assignments = data.items || [];
    if (assignments.length !== 1) {
      if (activeSetup?.assignment_autoset) {
        await DCLM_DB.clearActiveSetup();
        activeSetup = null;
      }
      if (assignments.length > 1) {
        showToast("You have more than one active program assignment. Choose the correct program in Setup.", "warning");
      }
      return;
    }
    const assigned = assignments[0];
    const event = assigned.event || {};
    const type = event.program_type || {};
    const domain = type.domain || {};
    const domainNames = {
      "Weekly Programs": "Weekly", "Global Crusade": "Crusade",
      "Conferences": "Conference", "Special Programs": "Special",
    };
    const levelNames = { location: "Local", group: "Group", region: "Region", state: "State" };
    const included = new Set(
      assigned.assignment_type === "all"
        ? ["count", "convert", "attendance"]
        : assigned.assignment_type === "both"
          ? ["count", "convert"] : [assigned.assignment_type],
    );
    const reportingLocationId = assigned.source_role === "alpha"
      ? String(event.alpha_location_id || "")
      : String(location.location_id);
    if (!reportingLocationId) {
      throw new Error("The assigned Alpha Location is missing. Ask the event administrator to correct the schedule.");
    }
    const combined = ["group", "region", "state"].includes(String(event.reporting_scope || "").toLowerCase());
    const identity = {
      church_type: location.church_type || "DCLM",
      program_domain: domainNames[domain.name] || domain.name || "",
      program_type: type.name || "",
      program_level: levelNames[String(event.reporting_scope || "").toLowerCase()] || "",
      location_id: reportingLocationId,
      assigned_location_id: reportingLocationId,
      location_name: location.location_name || "Assigned location",
      location_label: location.formatted_id || "",
      reporting_scope_code: reportingScopeCodeFromPath(event.path),
      service_date: event.date || "",
      event_id: event.id || "",
      event_title: event.title || type.name || "Assigned program",
      assignment_autoset: true,
      requires_count_assignment: included.has("count"),
      count_assignment_id: included.has("count") ? assigned.assignment_id : null,
      requires_convert_assignment: included.has("convert"),
      convert_assignment_id: included.has("convert") ? assigned.assignment_id : null,
      requires_attendance: combined && included.has("attendance"),
      attendance_assignment_id: combined && included.has("attendance") ? assigned.assignment_id : null,
    };
    if (!identity.program_domain || !identity.program_type || !identity.program_level || !identity.service_date || !identity.event_id) {
      throw new Error("Your active event assignment has incomplete program metadata. Ask the event administrator to correct it.");
    }
    await DCLM_DB.saveActiveSetup(identity);
    activeSetup = identity;
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
        ? `${activeSetup.program_type} · ${activeSetup.service_date} · Previously verified (offline)`
        : "Connect to load available scheduled events";
      select.replaceChildren(new Option(label, sameVerifiedContext ? activeSetup.event_id : ""));
      select.disabled = true;
      return;
    }
    select.replaceChildren(new Option("Loading matching events…", ""));
    select.disabled = true;
    try {
      const query = new URLSearchParams({ location_id: locationId, date: serviceDate, program_type: programType });
      const response = await window.DCLM_AUTH.apiFetch(`/api/events?${query}`);
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Could not load events.");
      const previous = select.value || (activeSetup?.location_id === locationId && activeSetup?.service_date === serviceDate ? activeSetup.event_id : "");
      const options = [new Option(data.items.length ? "No scheduled event selected" : "No matching event (routine services may continue without one)", "")];
      for (const event of data.items) {
        const eventLevel = reportingScopeLevel(event.reporting_scope);
        const eventScopeCode = reportingScopeCodeFromPath(event.path);
        const option = new Option([event.title || event.program_type?.name || programType, event.date, eventLevel, eventScopeCode].filter(Boolean).join(" · "), event.id);
        option.dataset.locationId = event.location_id || locationId;
        option.dataset.title = event.title || event.program_type?.name || programType;
        option.dataset.reportingScope = event.reporting_scope || "";
        option.dataset.reportingScopeCode = eventScopeCode;
        options.push(option);
      }
      select.replaceChildren(...options);
      if (previous && data.items.some((event) => String(event.id) === String(previous))) select.value = previous;
      select.disabled = false;
      syncReportingScopeFromEvent(prefix);
    } catch (error) {
      select.replaceChildren(new Option("Events unavailable; reconnect to load", ""));
      select.disabled = true;
      showToast(error.message, "warning");
    }
  }

  async function resolveEventAssignments(eventId, locationId) {
    if (!eventId || !locationId) {
      return { requires_count_assignment: false, count_assignment_id: null, requires_convert_assignment: false, convert_assignment_id: null, requires_attendance: false, attendance_assignment_id: null };
    }
    if (!navigator.onLine && activeSetup?.event_id === eventId && activeSetup?.location_id === locationId) {
      return {
        requires_count_assignment: Boolean(activeSetup.requires_count_assignment),
        count_assignment_id: activeSetup.count_assignment_id || null,
        count_assignment_ambiguous: Boolean(activeSetup.count_assignment_ambiguous),
        requires_convert_assignment: Boolean(activeSetup.requires_convert_assignment),
        convert_assignment_id: activeSetup.convert_assignment_id || null,
        convert_assignment_ambiguous: Boolean(activeSetup.convert_assignment_ambiguous),
        requires_attendance: Boolean(activeSetup.requires_attendance),
        attendance_assignment_id: activeSetup.attendance_assignment_id || null,
      };
    }
    const response = await window.DCLM_AUTH.apiFetch(
      `/api/events/${encodeURIComponent(eventId)}/field-assignments?location_id=${encodeURIComponent(locationId)}`,
    );
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Could not verify the count assignment.");
    const countAssignments = data.count_assignments || [];
    const convertAssignments = data.convert_assignments || [];
    const attendanceAssignments = data.attendance_assignments || [];
    return {
      requires_count_assignment: Boolean(data.required),
      count_assignment_id: countAssignments.length === 1 ? countAssignments[0].assignment_id : null,
      count_assignment_ambiguous: countAssignments.length > 1,
      requires_convert_assignment: Boolean(data.required),
      convert_assignment_id: convertAssignments.length === 1 ? convertAssignments[0].assignment_id : null,
      convert_assignment_ambiguous: convertAssignments.length > 1,
      requires_attendance: Boolean(data.requires_attendance),
      attendance_assignment_id: attendanceAssignments.length === 1 ? attendanceAssignments[0].assignment_id : null,
      attendance_assignment_ambiguous: attendanceAssignments.length > 1,
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
    const scopeToProgramLevel = {
      local: "Local", location: "Local", group: "Group", region: "Region",
      state: "State", national: "National", global: "Global",
    };
    const eventProgramLevel = scopeToProgramLevel[String(eventOption?.dataset.reportingScope || "").toLowerCase()];
    const selectedProgramLevel = formData.program_level || "Local";
    const selectedScopeCode = String(formData.reporting_scope_code || "").trim().toUpperCase();
    const eventScopeCode = String(eventOption?.dataset.reportingScopeCode || "").trim().toUpperCase();
    if (selectedEventId) {
      if (!eventProgramLevel || !eventScopeCode) {
        showToast("This scheduled event has no supported reporting level or hierarchy ID. Ask an administrator to correct the event scope.", "warning");
        return false;
      }
      if (selectedProgramLevel !== eventProgramLevel || selectedScopeCode !== eventScopeCode) {
        showToast(`Reporting level and ID must match the selected event (${eventProgramLevel} · ${eventScopeCode}).`, "warning");
        return false;
      }
    } else {
      const assignedCode = String(assignedLocation?.formatted_id || "").trim().toUpperCase();
      if (selectedProgramLevel !== "Local" || !assignedCode || selectedScopeCode !== assignedCode) {
        showToast("A broader or different location scope requires a matching scheduled event. Routine submissions use your assigned location.", "warning");
        return false;
      }
    }
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
      event_title: selectedEventId ? (eventOption?.dataset.title || formData.program_type) : formData.program_type,
      program_level: eventProgramLevel || selectedProgramLevel,
      reporting_scope_code: eventScopeCode || selectedScopeCode,
      location_id: eventLocationId,
      assigned_location_id: assignedLocation?.location_id || normalizedLocation,
      location_label: selectedScopeCode || assignedLocation?.formatted_id || assignedLocation?.location_name || "Assigned location",
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
      requires_attendance: countAssignment.requires_attendance,
      attendance_assignment_id: countAssignment.attendance_assignment_id,
      attendance_assignment_ambiguous: countAssignment.attendance_assignment_ambiguous || false,
    };

    const draft = await DCLM_DB.getCountDraft();
    const draftContextChanged = draft && [
      "event_id", "location_id", "program_type", "program_domain", "program_level", "reporting_scope_code", "church_type", "service_date",
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

    await refreshActiveSetup();
    updateAttendanceSetupGate();
    if (activeScreen === "attendance" && isWorkerAttendanceProgram()) {
      await fetchLocationRoster(identity.assigned_location_id || identity.location_id);
    }
    return true;
  }

  async function initSetupBindings() {
    await loadAssignedLocation();
    bindDomainTypeSync("modal_program_domain", "modal_program_type");
    bindDomainTypeSync("page_program_domain", "page_program_type");

    // Modal save
    const modalSaveBtn = qs("#btn-save-modal-setup");
    if (modalSaveBtn) {
      modalSaveBtn.addEventListener("click", () => runButtonAction(modalSaveBtn, "Saving...", async () => {
        const success = await handleSaveSetup({
          church_type: qs("#modal_church_type")?.value || assignedLocation?.church_type || "DCLM",
          program_domain: qs("#modal_program_domain")?.value,
          program_type: qs("#modal_program_type")?.value,
          program_level: qs("#modal_program_level")?.value,
          reporting_scope_code: qs("#modal_reporting_scope_code")?.value,
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
      }));
    }

    // Page save
    const pageSaveBtn = qs("#btn-save-page-setup");
    if (pageSaveBtn) {
      pageSaveBtn.addEventListener("click", () => runButtonAction(pageSaveBtn, "Saving...", async () => {
        const success = await handleSaveSetup({
          church_type: qs("#page_church_type")?.value || assignedLocation?.church_type || "DCLM",
          program_domain: qs("#page_program_domain")?.value,
          program_type: qs("#page_program_type")?.value,
          program_level: qs("#page_program_level")?.value,
          reporting_scope_code: qs("#page_reporting_scope_code")?.value,
          location_id: qs("#page_location_id")?.value,
          service_date: qs("#page_service_date")?.value,
          event_id: qs("#page_event_id")?.value,
        });

        if (success) {
          setTimeout(() => { window.location.href = "/"; }, 400);
        }
      }));
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
      if (qs("#modal_reporting_scope_code")) qs("#modal_reporting_scope_code").value = activeSetup.reporting_scope_code || activeSetup.location_label || assignedLocation?.formatted_id || "";
      if (qs("#modal_location_id")) qs("#modal_location_id").value = activeSetup.assigned_location_id || activeSetup.location_id || "";
      if (qs("#modal_location_label")) qs("#modal_location_label").value = assignedLocation ? `${assignedLocation.location_name} · ${assignedLocation.formatted_id}` : "";
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
      if (qs("#page_reporting_scope_code")) qs("#page_reporting_scope_code").value = activeSetup.reporting_scope_code || activeSetup.location_label || assignedLocation?.formatted_id || "";
      if (qs("#page_location_id")) qs("#page_location_id").value = activeSetup.assigned_location_id || activeSetup.location_id || "";
      if (qs("#page_location_label")) qs("#page_location_label").value = assignedLocation ? `${assignedLocation.location_name} · ${assignedLocation.formatted_id}` : "";
      if (qs("#page_service_date")) qs("#page_service_date").value = activeSetup.service_date || todayISO();
      if (qs("#page_event_id")) qs("#page_event_id").value = activeSetup.event_id || "";
    } else {
      if (qs("#modal_service_date")) qs("#modal_service_date").value = todayISO();
      if (qs("#page_service_date")) qs("#page_service_date").value = todayISO();
      if (qs("#modal_reporting_scope_code")) qs("#modal_reporting_scope_code").value = assignedLocation?.formatted_id || "";
      if (qs("#page_reporting_scope_code")) qs("#page_reporting_scope_code").value = assignedLocation?.formatted_id || "";
    }
    for (const prefix of ["modal", "page"]) {
      for (const field of ["location_id", "service_date", "program_type"]) {
        qs(`#${prefix}_${field}`)?.addEventListener("change", () => loadProgramEvents(prefix));
      }
      qs(`#${prefix}_event_id`)?.addEventListener("change", () => syncReportingScopeFromEvent(prefix));
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
          const nextTotal = Object.values(counterState).reduce((a, b) => a + b, 0) + 1;
          haptic(nextTotal % 50 === 0 ? "milestone" : "tick");
          counterState[category] += 1;
          updateCounterDisplays();
          await persistCountDraft();

          // Brief visual pulse on the tile number
          const numEl = tile.querySelector(".dclm-count-num");
          if (numEl) {
            numEl.classList.add("dclm-count-pulse");
            setTimeout(() => numEl.classList.remove("dclm-count-pulse"), 120);
          }

        }
      });
    });

    // Reset button
    const resetBtn = qs("#btn-reset-counter");
    if (resetBtn) {
      resetBtn.addEventListener("click", async () => {
        if (await confirm("Reset all population tallies to zero?", { title: "Reset population count", confirmLabel: "Reset", danger: true })) {
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

        const fundType = qs("#offering-fund-type")?.value || "";
        const paymentMethod = qs("#offering-payment-method")?.value || "cash";
        if (!["tithe", "offering", "tithe_offering"].includes(fundType)) {
          showToast("Choose Tithe, Offering, or Tithe & Offering.", "warning");
          return;
        }

        const item = {
          client_id: generateUUID(),
          location_id: activeSetup.location_id,
          event_id: activeSetup.event_id || null,
          amount: amount,
          fund_type: fundType,
          payment_method: paymentMethod,
          recorded_at: new Date().toISOString(),
          church_type: activeSetup.church_type,
          program_level: activeSetup.program_level,
          program_domain: activeSetup.program_domain,
          program_type: activeSetup.program_type,
          service_date: activeSetup.service_date,
        };

        const result = await runButtonAction(offeringSubmitBtn, "Saving...", () => DCLM_SYNC.submitOrQueue("offerings_queue", item));
        if (!result) return;
        if (result.cancelled) return;
        if (!result.submitted && !result.queued) return;
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
          program_level: activeSetup.program_level,
          program_domain: activeSetup.program_domain,
          program_type: activeSetup.program_type,
          service_date: activeSetup.service_date,
        };

        const result = await runButtonAction(finalizeCountBtn, "Saving...", () => DCLM_SYNC.submitOrQueue("counts_queue", batch));
        if (!result) return;
        if (result.cancelled) return;
        if (!result.submitted && !result.queued) return;
        await DCLM_DB.clearCountDraft();
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
    const pendingWorkers = await DCLM_DB.getAttendancePendingWorkerIds(eventContextKey());
    cachedRoster = cached.map((worker) => ({ ...worker,
      attendance_submitted: submittedWorkers.has(String(worker.worker_id)),
      attendance_queued: pendingWorkers.has(String(worker.worker_id)) && !submittedWorkers.has(String(worker.worker_id)),
    }));
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
      if (activeSetup?.event_id && activeSetup?.requires_attendance) {
        if (!activeSetup.attendance_assignment_id) throw new Error("This combined meeting requires your approved attendance assignment.");
        const response = await window.DCLM_AUTH.apiFetch(`/api/events/${encodeURIComponent(activeSetup.event_id)}/attendance-roster`);
        const data = await response.json();
        if (!response.ok || !data.ok || !Array.isArray(data.items)) throw new Error(data.error || "Could not load the assigned combined-meeting roster.");
        cachedRoster = data.items.map((worker) => ({ ...worker, marked_present: false,
          attendance_submitted: submittedWorkers.has(String(worker.worker_id)),
          attendance_queued: pendingWorkers.has(String(worker.worker_id)) && !submittedWorkers.has(String(worker.worker_id)),
        }));
        await DCLM_DB.saveWorkerRoster(cachedRoster, locationId);
        rosterState = cachedRoster.length ? "fresh" : "empty";
        showToast(`Combined roster refreshed: ${cachedRoster.length} approved workers.`, cachedRoster.length ? "success" : "info");
        renderWorkerRoster();
        return;
      }
      const rosterItems = [];
      for (let skip = 0; skip <= 5000; skip += 500) {
        const resp = await window.DCLM_AUTH.apiFetch(`/api/workers?location_id=${encodeURIComponent(locationId)}&skip=${skip}&limit=500`);
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Could not load the worker roster.");
        if (!data.ok || !Array.isArray(data.items)) throw new Error("The worker roster response was invalid.");
        if (skip >= 5000 && data.items.length) throw new Error("This location has more than 5,000 workers. Ask the administrator to divide the roster capture.");
        if (skip >= 5000) break;
        rosterItems.push(...data.items);
        if (data.items.length < 500) break;
      }
      cachedRoster = rosterItems.map((worker) => ({
        ...worker,
        marked_present: false,
        attendance_submitted: submittedWorkers.has(String(worker.worker_id)),
        attendance_queued: pendingWorkers.has(String(worker.worker_id)) && !submittedWorkers.has(String(worker.worker_id)),
      }));
      await DCLM_DB.saveWorkerRoster(cachedRoster, locationId);
      rosterState = cachedRoster.length ? "fresh" : "empty";
      showToast(cachedRoster.length
        ? `Roster refreshed: ${cachedRoster.length} workers for ${assignedLocation?.location_name || displayLocationId(locationId)}.`
        : "No approved workers were returned for this location.", cachedRoster.length ? "success" : "info");
      renderWorkerRoster();
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
            ? "Loading the approved worker roster…"
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
      card.className = `dclm-worker-card ${worker.marked_present ? "is-marked" : ""} ${worker.attendance_submitted ? "is-submitted" : ""} ${worker.attendance_queued ? "is-queued" : ""}`;
      card.innerHTML = `
        <div class="d-flex align-items-center gap-3">
          <div class="rounded-circle bg-primary-subtle text-primary fw-bold d-flex align-items-center justify-content-center" style="width: 44px; height: 44px; font-size: 0.95rem;">
            ${escapeHTML((worker.name || "W").split(" ").map(p => p[0]).slice(0, 2).join(""))}
          </div>
          <div>
            <div class="fw-bold text-dark mb-0">${escapeHTML(worker.name)}</div>
            <div class="small text-muted">${escapeHTML(worker.phone)} • ${escapeHTML(worker.unit || "General Worker")}</div>
          </div>
        </div>
        <button type="button" class="dclm-check-btn ${worker.marked_present ? "is-checked" : ""} ${worker.attendance_submitted ? "is-submitted" : ""} ${worker.attendance_queued ? "is-queued" : ""}" ${worker.attendance_submitted || worker.attendance_queued ? "disabled" : ""} aria-label="${worker.attendance_submitted ? "Attendance submitted" : worker.attendance_queued ? "Attendance queued" : "Toggle attendance"}">
          ${worker.attendance_submitted ? "Submitted" : worker.attendance_queued ? "Queued" : worker.marked_present ? "Present" : ""}
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

  async function renderAttendanceReview() {
    const presentListEl = qs("#review-marked-list");
    const presentCountEl = qs("#review-present-count");
    const rosterCountEl = qs("#review-roster-count");
    if (!presentListEl) return;
    if (!isWorkerAttendanceProgram()) {
      const submitButton = qs("#btn-approve-attendance-batch");
      if (submitButton) submitButton.disabled = true;
      presentListEl.innerHTML = '<div class="text-warning text-center py-4 small">Select a Workers Meeting, Leaders Meeting, or a worker/leader conference or retreat to review attendance.</div>';
      return;
    }

    const roster = await DCLM_DB.getWorkerRoster(activeSetup.location_id, eventContextKey());
    const marked = roster.filter((worker) => worker.marked_present);
    if (presentCountEl) presentCountEl.textContent = marked.length.toLocaleString();
    if (rosterCountEl) rosterCountEl.textContent = roster.length.toLocaleString();
    const locationName = assignedLocation?.location_name || activeSetup.location_name || "Assigned location";
    const locationCode = safeUiText(activeSetup.reporting_scope_code || displayLocationId(activeSetup.assigned_location_id || activeSetup.location_id));
    const programEl = qs("#review-setup-program");
    const locationEl = qs("#review-setup-location");
    const locationIdEl = qs("#review-setup-location-id");
    const dayEl = qs("#review-setup-day");
    if (programEl) programEl.textContent = safeUiText(activeSetup.event_title || activeSetup.program_type || "Church program");
    if (locationEl) locationEl.textContent = safeUiText(locationName);
    if (locationIdEl) locationIdEl.textContent = locationCode;
    if (dayEl) dayEl.textContent = new Date(`${activeSetup.service_date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "short", day: "numeric" });

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
      name.textContent = safeUiText(worker.name || "Church Worker");
      const details = document.createElement("div");
      details.className = "text-muted";
      details.style.fontSize = "0.75rem";
      details.textContent = safeUiText(`${worker.phone || ""} · ${worker.unit || "Worker"}`);
      info.append(name, details);
      const badge = document.createElement("span");
      badge.className = "badge bg-success-subtle text-success rounded-pill px-3 py-1 small";
      badge.textContent = "Present";
      row.append(info, badge);
      presentListEl.appendChild(row);
    }
  }

  async function submitAttendanceBatch() {
    if (!isWorkerAttendanceProgram()) {
      showToast("Attendance can only be submitted for worker or leader meetings, conferences, and retreats.", "warning");
      return;
    }
    if (!activeSetup?.location_id || !activeSetup?.service_date || !activeSetup?.program_type
        || (requiresScheduledEvent() && !activeSetup.event_id)) {
      showToast(requiresScheduledEvent()
        ? "Select the scheduled crusade event before reviewing attendance."
        : "Complete service setup before reviewing attendance.", "warning");
      return;
    }
    const contextKey = eventContextKey();
    const roster = await DCLM_DB.getWorkerRoster(activeSetup.location_id, contextKey);
    const marked = roster.filter((worker) => worker.marked_present);
    if (!marked.length) {
      showToast("No workers marked present to submit.", "warning");
      haptic("warning");
      return;
    }

    const submittedWorkers = await DCLM_DB.getAttendanceSubmittedWorkerIds(contextKey);
    const presentWorkers = marked.filter((worker) => !submittedWorkers.has(String(worker.worker_id)));
    if (!presentWorkers.length) {
      showToast("These workers already have attendance records queued or confirmed for this event.", "info");
      return;
    }
    if (navigator.onLine && !(await confirm("Editing attendance after submission requires elevated approval. Submit the marked attendance now?", { title: "Submit workers attendance", confirmLabel: "Submit" }))) return;

    const submitButton = qs("#btn-approve-attendance-batch");
    const attendanceCapture = {
      client_id: generateUUID(),
      location_id: activeSetup.location_id,
      event_id: activeSetup.event_id || null,
      assignment_id: activeSetup.attendance_assignment_id || null,
      context_key: contextKey,
      church_type: activeSetup.church_type,
      program_level: activeSetup.program_level,
      program_domain: activeSetup.program_domain,
      program_type: activeSetup.program_type,
      service_date: activeSetup.service_date,
      expected_workers_count: roster.length,
      present_workers: presentWorkers.map((worker) => ({
        worker_id: worker.worker_id,
        worker_name: worker.name || "Church Worker",
      })),
      submitted_by_worker_id: window.DCLM_CURRENT_USER?.worker_id || null,
      recorded_at: new Date().toISOString(),
    };
    const submission = await runButtonAction(submitButton, "Submitting...", () =>
      DCLM_SYNC.submitOrQueue("attendance_queue", attendanceCapture, { skipEditWarning: true, forceImmediate: true }));
    if (!submission) return;
    if (!submission.submitted && !submission.queued) return;
    const queuedWorkers = await DCLM_DB.getAttendancePendingWorkerIds(contextKey);
    const confirmedWorkers = await DCLM_DB.getAttendanceSubmittedWorkerIds(contextKey);
    cachedRoster = roster.map((worker) => {
      const id = String(worker.worker_id);
      worker.marked_present = false;
      worker.attendance_submitted = confirmedWorkers.has(id);
      worker.attendance_queued = queuedWorkers.has(id) && !worker.attendance_submitted;
      return worker;
    });
    await Promise.all(roster.map((worker) => DCLM_DB.updateWorkerCheck(worker.worker_id, false, contextKey)));
    renderWorkerRoster();
    await renderAttendanceReview();
    haptic("success");
    if (submission.submitted > 0 && submission.queued === 0) {
      await DCLM_DB.clearAttendanceMarks(eventContextKey());
      await DCLM_DB.clearQueue("worker_roster");
      await DCLM_DB.clearActiveSetup();
      cachedRoster = [];
      await refreshActiveSetup();
      updateAttendanceSetupGate();
      showToast("Attendance submitted. Setup and marked data were cleared for the next session.", "success");
    } else {
      showToast(submission.queued ? "Attendance saved on this device and queued for sync. Setup stays available until server confirmation." : "Attendance submitted successfully.", submission.queued ? "warning" : "success");
    }
    await renderAttendanceReview();
  }

  function updateAttendanceSetupGate() {
    const allowed = isWorkerAttendanceProgram();
    const warning = qs("#attendance-setup-warning");
    if (warning) warning.classList.toggle("d-none", allowed);
    const input = qs("#worker-search-input");
    const refresh = qs("#btn-refresh-worker-roster");
    const approve = qs("#btn-approve-attendance-batch");
    if (input) input.disabled = !allowed;
    if (refresh) refresh.disabled = !allowed;
    if (approve) approve.disabled = !allowed;
    if (!allowed) {
      const list = qs("#worker-roster-list");
      if (list) list.innerHTML = '<div class="text-warning text-center py-4 small">Choose a Workers Meeting, Leaders Meeting, or a worker/leader conference or retreat in Program Setup.</div>';
    }
    return allowed;
  }

  function initAttendanceBindings() {
    const allowed = updateAttendanceSetupGate();
    const searchInput = qs("#worker-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", renderWorkerRoster);
    }

    const refreshRosterBtn = qs("#btn-refresh-worker-roster");
    if (refreshRosterBtn && activeSetup) {
      refreshRosterBtn.addEventListener("click", () => {
        void runButtonAction(refreshRosterBtn, "Refreshing...", () => fetchLocationRoster(activeSetup.location_id));
      });
    }
    qs("#btn-approve-attendance-batch")?.addEventListener("click", submitAttendanceBatch);

    if (!allowed) {
      // Setup can be changed from this page; listeners stay active and the gate updates immediately.
    } else if (activeScreen === "fellowship") {
      // Fellowship reports use their own authorized fellowship ID and date.
    } else if (activeSetup && activeSetup.location_id && !window.location.pathname.endsWith("/review")) {
      fetchLocationRoster(activeSetup.location_id);
    }
  }

  // -------------------------------------------------------------
  // Converts & Newcomer Registration Engine
  // -------------------------------------------------------------
  function initRegistrationBindings() {
    const convertBtn = qs("#toggle-btn-convert");
    const newcomerBtn = qs("#toggle-btn-newcomer");
    const workerCandidateBtn = qs("#toggle-btn-worker-candidate");
    const recordTypeInput = qs("#reg_record_type");
    const registrationFormCard = qs("#registration-entry-form")?.closest(".dclm-card");
    const workerCandidateCard = qs("#worker-candidate-form")?.closest(".dclm-card");

    const setRegistrationMode = (mode) => {
      const isWorkerCandidate = mode === "worker_candidate";
      if (registrationFormCard) registrationFormCard.style.display = isWorkerCandidate ? "none" : "";
      if (workerCandidateCard) workerCandidateCard.style.display = isWorkerCandidate ? "" : "none";
      convertBtn?.classList.toggle("btn-primary", mode === "convert");
      convertBtn?.classList.toggle("btn-outline-secondary", mode !== "convert");
      newcomerBtn?.classList.toggle("btn-primary", mode === "newcomer");
      newcomerBtn?.classList.toggle("btn-outline-secondary", mode !== "newcomer");
      workerCandidateBtn?.classList.toggle("btn-primary", isWorkerCandidate);
      workerCandidateBtn?.classList.toggle("btn-outline-secondary", !isWorkerCandidate);
      if (recordTypeInput && mode !== "worker_candidate") recordTypeInput.value = mode;
    };

    if (convertBtn && newcomerBtn) {
      convertBtn.addEventListener("click", () => setRegistrationMode("convert"));
      newcomerBtn.addEventListener("click", () => setRegistrationMode("newcomer"));
    }
    workerCandidateBtn?.addEventListener("click", () => setRegistrationMode("worker_candidate"));

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
          showToast("Use a name up to 120 characters and a phone number with 7–15 digits.", "warning");
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
          program_level: activeSetup.program_level,
          program_domain: activeSetup.program_domain,
          program_type: activeSetup.program_type,
          service_date: activeSetup.service_date,
          captured_at: new Date().toISOString(),
        };

        try {
          const result = await runButtonAction(regSubmitBtn, "Saving...", () => DCLM_SYNC.submitOrQueue("registration_queue", record));
          if (!result) return;
          if (result.cancelled) return;
          if (!result.submitted && !result.queued) return;
          haptic("success");
          qs("#registration-entry-form")?.reset();
          if (recordTypeInput) recordTypeInput.value = "convert";
          if (convertBtn && newcomerBtn) {
            convertBtn.className = "btn btn-primary w-100 rounded-pill py-2 fw-semibold";
            newcomerBtn.className = "btn btn-outline-secondary w-100 rounded-pill py-2 fw-semibold";
          }
        } catch (error) { showToast(`Could not save this registration: ${safeUiText(error.message)}`, "danger"); }
      });
    }

    const workerCandidateSubmit = qs("#btn-submit-worker-candidate");
    workerCandidateSubmit?.addEventListener("click", async () => {
      const name = qs("#candidate_name")?.value.trim() || "";
      const gender = qs("#candidate_gender")?.value || "";
      const phone = (qs("#candidate_phone")?.value.trim() || "").replace(/[\s()-]/g, "");
      const email = qs("#candidate_email")?.value.trim() || "";
      const unit = qs("#candidate_unit")?.value.trim() || "";
      if (!name || !gender || !phone || !email || !unit) {
        showToast("Name, gender, phone, email, and worker unit are required.", "warning");
        return;
      }
      if (!/^\+?\d{7,15}$/.test(phone) || name.length > 255 || unit.length > 120) {
        showToast("Check the candidate name, phone number, and worker unit.", "warning");
        return;
      }
      const candidate = {
        client_id: generateUUID(), name, gender, phone, email, unit,
        address: qs("#candidate_address")?.value.trim() || null,
        occupation: qs("#candidate_occupation")?.value.trim() || null,
        marital_status: qs("#candidate_marital_status")?.value || null,
      };
      try {
        if (!activeSetup?.location_id || !activeSetup?.service_date || !activeSetup?.program_type) {
          showToast("Complete program setup before registering a worker candidate.", "warning");
          return;
        }
        const result = await runButtonAction(workerCandidateSubmit, "Saving...", () =>
          DCLM_SYNC.submitOrQueue("worker_candidates_queue", candidate));
        if (!result || (!result.submitted && !result.queued)) return;
        qs("#worker-candidate-form")?.reset();
        haptic("success");
      } catch (error) {
        showToast(`Could not save worker candidate: ${safeUiText(error.message)}`, "danger");
      }
    });
  }

  function initFellowshipBindings() {
    const select = qs("#fellowship_id");
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
          const category = fellowship.fellowship_group_label || "Category not configured";
        select.add(new Option(safeUiText(`${fellowship.name} · ${category}${fellowship.code ? ` · ${fellowship.code}` : ""}`), fellowship.fellowship_id));
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
      const group = store === "fellowship_members_queue" ? fellowship.fellowship_group : undefined;
      if (store === "fellowship_members_queue" && !group) {
        showToast("This fellowship has no category yet. Ask the administrator to assign its category before adding members.", "warning");
        return false;
      }
      return DCLM_SYNC.submitOrQueue(store, {
        client_id: generateUUID(), fellowship_id: fellowship.fellowship_id, fellowship_name: fellowship.name,
        fellowship_group: group,
        location_id: assignedLocation?.location_id || window.DCLM_CURRENT_USER?.location_id || "",
        ...extra,
      });
    };

    const attendanceSaveButton = qs("#btn-save-fellowship-attendance");
    attendanceSaveButton?.addEventListener("click", async () => {
      const values = Object.fromEntries(["men", "women", "youths", "children"].map((key) => [key, qs(`#fellowship_${key}`)?.value || "0"]));
      if (Object.values(values).some((value) => !/^\d{1,6}$/.test(value))) { showToast("Attendance categories must be whole numbers from 0 to 999999.", "warning"); return; }
      const date = qs("#fellowship_attendance_date")?.value;
      if (!date) { showToast("Choose the meeting date.", "warning"); return; }
      await runButtonAction(attendanceSaveButton, "Saving...", () => save("fellowship_attendance_queue", { ...values, date, topic: qs("#fellowship_topic")?.value.trim() || null }));
    });
    const offeringSaveButton = qs("#btn-save-fellowship-offering");
    offeringSaveButton?.addEventListener("click", async () => {
      const amount = qs("#fellowship_offering_amount")?.value.trim() || "";
      const date = qs("#fellowship_offering_date")?.value;
      if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) { showToast("Enter a positive amount with up to two decimal places.", "warning"); return; }
      if (!date) { showToast("Choose the meeting date.", "warning"); return; }
      const result = await runButtonAction(offeringSaveButton, "Saving...", () => save("fellowship_offerings_queue", { amount, date, note: qs("#fellowship_offering_note")?.value.trim() || null }));
      if (result && (result.submitted || result.queued)) qs("#fellowship_offering_amount").value = "";
    });
    const memberSaveButton = qs("#btn-save-fellowship-member");
    memberSaveButton?.addEventListener("click", async () => {
      const name = qs("#fellowship_member_name")?.value.trim() || "";
      const phone = qs("#fellowship_member_phone")?.value.trim() || "";
      const address = qs("#fellowship_member_address")?.value.trim() || "";
      if (!name || name.length > 120 || phone.length > 30 || !address || address.length > 300) {
        showToast("Enter the member name and home address (up to 300 characters); phone must be 30 characters or fewer.", "warning");
        return;
      }
      const result = await runButtonAction(memberSaveButton, "Saving...", () => save("fellowship_members_queue", { name, phone: phone || null, address }));
      if (!result || (!result.submitted && !result.queued)) return;
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

    await DCLM_DB.normalizeLegacyAttendanceQueue();

    const legacyCount = await DCLM_DB.getUnassignedQueueCount();
    const legacyNotice = qs("#legacy-queue-notice");
    const legacyMessage = qs("#legacy-queue-message");
    if (legacyNotice) legacyNotice.classList.toggle("d-none", legacyCount === 0);
    if (legacyMessage && legacyCount) legacyMessage.textContent = `${legacyCount} older saved record(s) have no account owner. Claiming assigns them to your signed-in account.`;

    const counts = await DCLM_DB.getAllFromQueue("counts_queue");
    const offerings = await DCLM_DB.getAllFromQueue("offerings_queue");
    const attendance = await DCLM_DB.getAllFromQueue("attendance_queue");
    const registrations = await DCLM_DB.getAllFromQueue("registration_queue");
    const workerCandidates = await DCLM_DB.getAllFromQueue("worker_candidates_queue");
    const fellowshipMembers = await DCLM_DB.getAllFromQueue("fellowship_members_queue");
    const fellowshipAttendance = await DCLM_DB.getAllFromQueue("fellowship_attendance_queue");
    const fellowshipOfferings = await DCLM_DB.getAllFromQueue("fellowship_offerings_queue");

    const totalBatches = counts.length + offerings.length + attendance.length + registrations.length + workerCandidates.length
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
              <div class="small text-muted">${escapeHTML(item.program_type || "Church service")} · ${escapeHTML(item.service_date)}</div>
              ${item.last_error ? `<div class="small text-danger mt-1">Sync issue: ${escapeHTML(item.last_error)}</div>` : ""}
            </div>
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-sm btn-outline-primary rounded-pill px-3" data-edit-count-id="${escapeHTML(item.client_id)}">Edit</button>
              <button type="button" class="btn btn-sm btn-primary rounded-pill px-3" data-sync-store="counts_queue" data-sync-id="${escapeHTML(item.client_id)}">Sync</button>
              <button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-3" data-discard-store="counts_queue" data-discard-id="${escapeHTML(item.client_id)}">Discard</button>
            </div>
          </div>
        `;
      });

      offerings.forEach((item) => {
        html += `
          <div class="dclm-queue-item type-offering">
            <div>
              <div class="fw-bold text-dark small"><i class="bi bi-wallet2 text-success me-1"></i> Offering / Tithe (₦${Number(item.amount).toLocaleString()})</div>
              <div class="small text-muted">${escapeHTML(item.fund_type)} via ${escapeHTML(item.payment_method)}</div>
              ${item.last_error ? `<div class="small text-danger mt-1">Sync issue: ${escapeHTML(item.last_error)}</div>` : ""}
            </div>
          <div class="d-flex gap-2"><button type="button" class="btn btn-sm btn-primary rounded-pill px-3" data-sync-store="offerings_queue" data-sync-id="${escapeHTML(item.client_id)}">Sync</button><button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-3" data-discard-store="offerings_queue" data-discard-id="${escapeHTML(item.client_id)}">Discard</button></div>
          </div>
        `;
      });

      attendance.forEach((item) => {
        html += `
          <div class="dclm-queue-item type-attendance">
            <div>
              <div class="fw-bold text-dark small"><i class="bi bi-person-check-fill text-info me-1"></i> Worker Attendance - ${escapeHTML(Array.isArray(item.present_workers) ? `${item.present_workers.length} workers of ${Number(item.expected_workers_count || 0).toLocaleString()}` : item.worker_name || "Legacy individual record")}</div>
              <div class="small text-muted">${escapeHTML(item.program_type || "Workers Meeting")} - ${escapeHTML(item.service_date || "Date unavailable")}</div>
              ${Array.isArray(item.present_workers) ? `<div class="small text-muted mt-1">${escapeHTML(item.present_workers.slice(0, 5).map((worker) => worker.worker_name || worker.name || "Church Worker").join(", "))}${item.present_workers.length > 5 ? ` + ${item.present_workers.length - 5} more` : ""}</div>` : ""}
              ${item.last_error ? `<div class="small text-danger mt-1">Sync issue: ${escapeHTML(item.last_error)}</div>` : ""}
            </div>
            <div class="d-flex gap-2"><button class="btn btn-sm btn-primary rounded-pill px-3" data-sync-store="attendance_queue" data-sync-id="${escapeHTML(item.client_id)}">Sync</button><button class="btn btn-sm btn-outline-danger rounded-pill px-3" data-discard-store="attendance_queue" data-discard-id="${escapeHTML(item.client_id)}">Discard</button></div>
          </div>
        `;
      });

      registrations.forEach((item) => {
        html += `
          <div class="dclm-queue-item type-register">
            <div>
              <div class="fw-bold text-dark small"><i class="bi bi-person-plus-fill text-warning me-1"></i> ${item.record_type === "convert" ? "Convert" : "Guest"}: ${escapeHTML(item.name)}</div>
              <div class="small text-muted">${escapeHTML(item.phone)} • ${escapeHTML(item.details?.salvation_type || "Follow-up")}</div>
              ${item.last_error ? `<div class="small text-danger mt-1">Sync issue: ${escapeHTML(item.last_error)}</div>` : ""}
            </div>
          <div class="d-flex gap-2"><button type="button" class="btn btn-sm btn-primary rounded-pill px-3" data-sync-store="registration_queue" data-sync-id="${escapeHTML(item.client_id)}">Sync</button><button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-3" data-discard-store="registration_queue" data-discard-id="${escapeHTML(item.client_id)}">Discard</button></div>
          </div>
        `;
      });

      workerCandidates.forEach((item) => {
        html += `
          <div class="dclm-queue-item type-register">
            <div>
              <div class="fw-bold text-dark small"><i class="bi bi-person-vcard-fill text-primary me-1"></i> Worker Candidate: ${escapeHTML(item.name)}</div>
              <div class="small text-muted">${escapeHTML(item.phone)} · ${escapeHTML(item.unit)}</div>
              ${item.last_error ? `<div class="small text-danger mt-1">Sync issue: ${escapeHTML(item.last_error)}</div>` : ""}
            </div>
            <div class="d-flex gap-2"><button type="button" class="btn btn-sm btn-primary rounded-pill px-3" data-sync-store="worker_candidates_queue" data-sync-id="${escapeHTML(item.client_id)}">Sync</button><button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-3" data-discard-store="worker_candidates_queue" data-discard-id="${escapeHTML(item.client_id)}">Discard</button></div>
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
            ? `${Number(item.men) + Number(item.women) + Number(item.youths) + Number(item.children)} people · ${item.date}`
            : store === "fellowship_offerings_queue" ? `₦${Number(item.amount).toLocaleString()} · ${item.date}` : escapeHTML(item.name);
          html += `<div class="dclm-queue-item type-attendance"><div><div class="fw-bold text-dark small"><i class="bi bi-house-heart text-primary me-1"></i>${label}</div><div class="small text-muted">${escapeHTML(item.fellowship_name || "House Fellowship")} | ${detail}</div>${item.last_error ? `<div class="small text-danger mt-1">Sync issue: ${escapeHTML(item.last_error)}</div>` : ""}</div><div class="d-flex gap-2"><button type="button" class="btn btn-sm btn-primary rounded-pill px-3" data-sync-store="${store}" data-sync-id="${escapeHTML(item.client_id)}">Sync</button><button type="button" class="btn btn-sm btn-outline-danger rounded-pill px-3" data-discard-store="${store}" data-discard-id="${escapeHTML(item.client_id)}">Discard</button></div></div>`;
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
              <div class="text-muted" style="font-size: 0.75rem;">${new Date(r.synced_at).toLocaleTimeString()} • ${escapeHTML(displayLocationId(r.location_id))}</div>
            </div>
            <span class="badge bg-success text-white rounded-pill px-2 py-1 small">Synced</span>
          </div>
        `).join("");
      }
    }
  }

  function initQueuesBindings() {
    const listEl = qs("#pending-queue-list");
    let editingCount = null;
    listEl?.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const syncButton = target?.closest("[data-sync-store]");
      if (syncButton) {
        event.preventDefault();
        void runButtonAction(syncButton, "Syncing...", async () => {
          await DCLM_SYNC.syncQueueItem(syncButton.dataset.syncStore, syncButton.dataset.syncId);
          await renderQueuesView();
          await refreshHomeQueueSummary();
        });
        return;
      }
      const editCount = target?.closest("[data-edit-count-id]");
      if (editCount) {
        event.preventDefault();
        void runButtonAction(editCount, "Opening...", async () => {
          const items = await DCLM_DB.getAllFromQueue("counts_queue");
          editingCount = items.find((item) => String(item.client_id) === String(editCount.dataset.editCountId));
          if (!editingCount) {
            showToast("This saved population count is no longer available. Refresh the queue and try again.", "warning");
            await renderQueuesView();
            return;
          }
          ["adult_male", "adult_female", "youth_male", "youth_female", "boys", "girls"].forEach((key) => {
            const input = qs(`#queued_edit_${key}`);
            if (input) input.value = Number(editingCount[key] || 0);
          });
          const modalElement = qs("#queuedCountEditModal");
          if (!modalElement || typeof bootstrap === "undefined") throw new Error("The count editor could not open. Reload this page and try again.");
          bootstrap.Modal.getOrCreateInstance(modalElement).show();
        });
        return;
      }
      const discard = target?.closest("[data-discard-store]");
      if (discard) {
        event.preventDefault();
        void runButtonAction(discard, "Discarding...", () =>
          DCLM_APP.discardQueueItem(discard.dataset.discardStore, discard.dataset.discardId));
        return;
      }
      if (target?.closest("[data-discard-attendance]")) DCLM_APP.discardAllAttendance();
    });

    qs("#btn-save-queued-count")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      await runButtonAction(button, "Saving...", async () => {
        if (!editingCount) return;
        const keys = ["adult_male", "adult_female", "youth_male", "youth_female", "boys", "girls"];
        const values = Object.fromEntries(keys.map((key) => [key, Number(qs(`#queued_edit_${key}`)?.value || 0)]));
        if (Object.values(values).some((value) => !Number.isInteger(value) || value < 0 || value > 999999)) {
          showToast("Use whole number counts from 0 to 999999 in each category.", "warning");
          return;
        }
        const total = Object.values(values).reduce((sum, value) => sum + value, 0);
        if (total <= 0) {
          showToast("A population count must contain at least one person.", "warning");
          return;
        }
        await DCLM_DB.updateQueueItems("counts_queue", [{
          ...editingCount, ...values, total, status: "pending", last_error: null, updated_at: new Date().toISOString(),
        }]);
        editingCount = null;
        if (typeof bootstrap !== "undefined") bootstrap.Modal.getInstance(qs("#queuedCountEditModal"))?.hide();
        showToast("Pending population count updated.", "success");
        await renderQueuesView();
        await refreshHomeQueueSummary();
      });
    });

    const syncAllBtn = qs("#btn-sync-all-queues");
    syncAllBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      void runButtonAction(syncAllBtn, "Syncing...", () => DCLM_SYNC.syncAllQueues());
    });

    qs("#btn-claim-legacy-queues")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      await runButtonAction(button, "Claiming...", async () => {
        const count = await DCLM_DB.getUnassignedQueueCount();
        if (!count || !(await confirm(`Assign ${count} older saved record(s) to ${window.DCLM_CURRENT_USER?.name || "your account"}?`, { title: "Claim older records", confirmLabel: "Claim" }))) return;
        const claimed = await DCLM_DB.claimUnassignedQueueItems();
        showToast(`${claimed} older record(s) assigned to your account.`, "success");
        await renderQueuesView();
      });
    });

    void renderQueuesView();
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
    if (userLocation) userLocation.textContent = displayLocationId(user.location_id);
    updateNetworkStatus();
    refreshHapticsSetting();
    qs("#setting-haptics-enabled")?.addEventListener("change", async (event) => {
      await DCLM_DB.saveHapticsEnabled(event.currentTarget.checked);
      await refreshHapticsSetting();
      const didVibrate = haptic("tick");
      if (event.currentTarget.checked && !didVibrate) {
        const message = qs("#settings-haptics-status");
        if (message) message.textContent = "Vibration is enabled, but the browser blocked it. Install/open the app on a supported device and allow vibration in device settings.";
      }
      showToast(event.currentTarget.checked ? "Touch vibration enabled." : "Touch vibration disabled.", "info");
    });
    qs("#btn-test-haptics")?.addEventListener("click", () => {
      if (!window.__DCLM_HAPTICS_ENABLED__) {
        showToast("Enable touch vibration first.", "info");
        return;
      }
      if (!haptic("success")) {
        const message = qs("#settings-haptics-status");
        if (message) message.textContent = "The browser did not start vibration. Check device vibration settings, browser support, and that the app is open over HTTPS.";
      }
    });
    const modeSelect = qs("#submission-mode");
    if (modeSelect) {
      DCLM_DB.getSubmissionMode().then((mode) => { modeSelect.value = mode; });
      modeSelect.addEventListener("change", async () => {
        await DCLM_DB.saveSubmissionMode(modeSelect.value);
        showToast(modeSelect.value === "instant"
          ? "Records will submit as soon as you save while online."
          : "Records will stay queued until you choose Sync.", "success");
      });
    }

    // Clear worker roster cache
    const clearRosterBtn = qs("#btn-clear-roster-cache");
    if (clearRosterBtn) {
      clearRosterBtn.addEventListener("click", async () => {
        if (await confirm("Clear the cached worker roster? It will be re-fetched on next attendance session.", { title: "Clear worker roster", confirmLabel: "Clear", danger: true })) {
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
        if (await confirm("Delete this account's setup, cached roster, recent history, and all pending records from this device? Pending records cannot be recovered after deletion.", { title: "Clear saved device data", confirmLabel: "Delete all", danger: true })) {
          const stores = ["active_setup", "worker_roster", "app_settings", "counts_queue", "offerings_queue",
                          "attendance_queue", "registration_queue", "worker_candidates_queue", "fellowship_members_queue", "fellowship_attendance_queue",
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

    window.__DCLM_HAPTICS_ENABLED__ = await DCLM_DB.getHapticsEnabled();
    await refreshActiveSetup();
    await initSetupBindings();

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
    confirm,
    async onAttendanceSyncConfirmed(contextKey) {
      const remaining = await DCLM_DB.getAttendancePendingWorkerIds(contextKey);
      if (remaining.size) return;
      await DCLM_DB.clearAttendanceMarks(contextKey);
      await DCLM_DB.clearQueue("worker_roster");
      if (eventContextKey() === String(contextKey || "")) {
        await DCLM_DB.clearActiveSetup();
        activeSetup = null;
        await refreshActiveSetup();
        updateAttendanceSetupGate();
      }
    },
    refreshActiveSetup,
    refreshHomeQueueSummary,
    renderQueuesView,
    async discardQueueItem(storeName, key) {
      const approved = await confirm("Discard this unsubmitted item?", { title: "Discard saved record", confirmLabel: "Discard", danger: true });
      if (!approved) return false;
      const removed = await DCLM_DB.removeFromQueue(storeName, key);
      if (!removed) {
        showToast("This saved item was not found on this device. Refresh the queue and try again.", "warning");
        await renderQueuesView();
        return false;
      }
      await renderQueuesView();
      await refreshHomeQueueSummary();
      showToast("Item discarded.", "info");
      return true;
    },
    async discardAllAttendance() {
      if (await confirm("Discard all unsubmitted attendance records?", { title: "Discard attendance records", confirmLabel: "Discard all", danger: true })) {
        await DCLM_DB.clearQueue("attendance_queue");
        renderQueuesView();
        await refreshHomeQueueSummary();
        showToast("Attendance queue cleared.", "info");
      }
    },
  };
})();

// sync.js calls the public confirmation and post-sync hooks through window.
window.DCLM_APP = DCLM_APP;
