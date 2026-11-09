async (page) => {
  const mock = (pattern, body) => page.context().route(pattern, route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  }));
  await mock("**/api/auth/state", {
    ok: true, authenticated: true,
    user: { name: "Demo Usher", user_id: "demo-user", location_id: "demo-location", roles: ["Location Worker"], permissions: [] },
  });
  await mock("**/api/location-context", {
    ok: true,
    location: { location_id: "demo-location", location_name: "Demo Location", formatted_id: "DCL-234-KW-DEMO-001", church_type: "DCLM", program_level: "Local" },
  });
  await mock("**/api/events/assigned-to-me", { ok: true, items: [] });
  await mock("**/api/events*", { ok: true, items: [] });
  await mock("**/api/counts/suggestions/**", { ok: true, items: [{ label: "Main Hall", hidden: false }, { label: "Overflow", hidden: false }] });
  await page.goto("http://127.0.0.1:5098/counter");
  await page.waitForTimeout(1800);
  await page.evaluate(async () => DCLM_DB.saveActiveSetup({
    church_type: "DCLM", program_domain: "Weekly Programs", program_type: "Sunday Worship Service",
    program_level: "Local", reporting_scope_code: "DCL-234-KW-DEMO-001", location_id: "demo-location",
    assigned_location_id: "demo-location", service_date: "2026-11-08", event_id: null,
  }));
  await page.reload();
  await page.waitForTimeout(1800);
  await page.locator("#count-mode").check();
  await page.locator("#count-section-label").fill("Main Hall");
  await page.locator("#count-service-id").fill("Morning service");
  await page.waitForTimeout(500);
  await page.locator("#count-mode-card").screenshot({ path: "output/playwright/b5-utility-count-mode-card.png" });
  return await page.locator("body").innerText();
}
