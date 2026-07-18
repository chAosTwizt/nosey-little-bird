import assert from "node:assert/strict";
import { compareSemver, pickStaffZipAsset } from "../self-update.js";

assert.equal(compareSemver("2.2.6", "2.2.7"), -1);
assert.equal(compareSemver("2.2.7", "2.2.6"), 1);
assert.equal(compareSemver("v2.2.7", "2.2.7"), 0);
assert.equal(compareSemver("2.2.6", "2.2.6"), 0);

const asset = pickStaffZipAsset([
  { name: "Source code (zip)", browser_download_url: "http://x/src.zip" },
  {
    name: "nosey-little-bird-2.2.7-staff.zip",
    browser_download_url: "http://x/staff.zip",
  },
]);
assert.equal(asset.name, "nosey-little-bird-2.2.7-staff.zip");

console.log("self-update tests ok");
