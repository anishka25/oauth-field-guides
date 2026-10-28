// Read-only OAuth probes: discovery documents + authorize endpoint with a fake client_id.
const targets = {
  github: { disc: ["https://github.com/.well-known/openid-configuration","https://github.com/.well-known/oauth-authorization-server"], auth: "https://github.com/login/oauth/authorize?client_id=fake_probe_123&redirect_uri=http://localhost/cb" },
  slack: { disc: ["https://slack.com/.well-known/openid-configuration"], auth: "https://slack.com/oauth/v2/authorize?client_id=123.456&scope=chat:write" },
  google: { disc: ["https://accounts.google.com/.well-known/openid-configuration"], auth: "https://accounts.google.com/o/oauth2/v2/auth?client_id=fake.apps.googleusercontent.com&redirect_uri=http://localhost/cb&response_type=code&scope=openid" },
  notion: { disc: ["https://api.notion.com/.well-known/oauth-authorization-server","https://mcp.notion.com/.well-known/oauth-authorization-server"], auth: "https://api.notion.com/v1/oauth/authorize?client_id=00000000-0000-0000-0000-000000000000&response_type=code&owner=user&redirect_uri=http://localhost/cb" },
  mastodon: { disc: ["https://mastodon.social/.well-known/oauth-authorization-server"], auth: "https://mastodon.social/oauth/authorize?client_id=fake&response_type=code&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=read" },
  salesforce: { disc: ["https://login.salesforce.com/.well-known/openid-configuration"], auth: "https://login.salesforce.com/services/oauth2/authorize?client_id=fake&response_type=code&redirect_uri=http://localhost/cb" },
};
for (const [name, t] of Object.entries(targets)) {
  console.log(`\n== ${name}`);
  for (const u of t.disc) {
    try {
      const r = await fetch(u, { redirect: "manual" });
      let extra = "";
      if (r.ok) { const j = await r.json(); extra = JSON.stringify({ a: j.authorization_endpoint, t: j.token_endpoint, reg: j.registration_endpoint ?? null, pkce: j.code_challenge_methods_supported ?? null, scopes: (j.scopes_supported||[]).length }); }
      console.log(`DISC ${r.status} ${u} ${extra}`);
    } catch (e) { console.log(`DISC ERR ${u} ${e.message}`); }
  }
  try {
    const r = await fetch(t.auth, { redirect: "manual" });
    const body = (await r.text()).replace(/\s+/g, " ");
    const m = body.match(/(invalid[_ ]client[^<"]{0,80}|Application not found|client_id[^<"]{0,80}|not a valid[^<"]{0,60}|OAuth client was not found|error[^<"]{0,60})/i);
    console.log(`AUTH ${r.status} loc=${(r.headers.get("location")||"").slice(0,140)} hint=${m?.[0]?.slice(0,120) ?? "-"}`);
  } catch (e) { console.log(`AUTH ERR ${e.message}`); }
}
