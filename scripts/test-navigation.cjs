const test=require("node:test");
const assert=require("node:assert/strict");
const {NAVIGATION_ITEMS,navigationItemHeight}=require("./load-ts.cjs")("navigation");
test("home, memo, MCI and settings remain reachable with unique tab ids",()=>{
  assert.deepEqual(NAVIGATION_ITEMS.map(item=>item.id),["home","memo","mci","settings"]);
  assert.equal(new Set(NAVIGATION_ITEMS.map(item=>item.id)).size,4);
});
test("compact navigation fits scaled labels without shrinking touch targets",()=>{
  assert.equal(navigationItemHeight(1),50);
  for(const scale of [1,1.5,2,3]) {
    const height=navigationItemHeight(scale);
    assert.ok(height>=48);
    assert.ok(height>=20+2+17*scale+8);
  }
  assert.ok(navigationItemHeight(2)>navigationItemHeight(1));
});
