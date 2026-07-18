import assert from "node:assert/strict";
import { looksLikeAccessWall } from "../schedule-refresh.js";

assert.equal(
  looksLikeAccessWall(200, "text/html", "<title>Sign in ・ Cloudflare Access</title>"),
  true
);
assert.equal(looksLikeAccessWall(401, "text/plain", "nope"), true);
assert.equal(
  looksLikeAccessWall(200, "application/json", '{"weeks":[]}'),
  false
);
assert.equal(
  looksLikeAccessWall(200, "text/html", "<html><body>hello</body></html>"),
  true
);

console.log("schedule-refresh tests ok");
