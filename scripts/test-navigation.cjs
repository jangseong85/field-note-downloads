const test=require("node:test");
const assert=require("node:assert/strict");
const {NAVIGATION_ITEMS,navigationItemHeight}=require("./load-ts.cjs")("navigation");
test("five tabs split the record into patient, status, medication and records, then settings",()=>{
  assert.deepEqual(NAVIGATION_ITEMS.map(item=>item.id),["patient","status","medication","records","settings"]);
  assert.deepEqual(NAVIGATION_ITEMS.map(item=>item.label),["환자","상태","약물","기록","설정"]);
  assert.equal(new Set(NAVIGATION_ITEMS.map(item=>item.id)).size,5);
});
test("each record tab shows only its part; SMS sits under the attachments",()=>{
  const fs=require("node:fs"),path=require("node:path");
  const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
  const screen=read("src/PatientNoteScreen.tsx");
  for(const section of ["patient","status","medication"]) assert.match(screen,new RegExp(`p\\.section === "${section}" && `));
  assert.match(screen,/\{p\.section === "records" && <View style=\{\[s\.attachmentsSection/);
  assert.match(screen,/onBusyChange=\{p\.onMediaBusyChange\}\s+\/>\s+<Pressable\s+accessibilityRole="button"\s+accessibilityLabel="사진과 기록을 문자로 보내기"\s+disabled=\{p\.mediaBusy\}/);
  assert.match(screen,/<SendPhotosSheet\s+key=\{p\.activePatientId\}\s+visible=\{smsOpen\}/);
  assert.match(screen,/<MedicineBagAnalysis\b/);
  const media=read("src/MemoAttachments.tsx");
  assert.doesNotMatch(media,/SendPhotosSheet|문자로 보내기|MedicineBagAnalysis/);
  const app=read("App.tsx");
  assert.doesNotMatch(app,/문자로 보내기|setSmsOpen|chatbubble/);
  assert.match(app,/if \(activeTab === "patient"\) return false;\s+navigate\("patient"\);/);
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
