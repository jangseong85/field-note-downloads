const test = require("node:test");
const assert = require("node:assert/strict");
const load = require("./load-ts.cjs");
function fixture({failCommit = false, failOcr = false} = {}) {
  const cleaned = [], created = [], events = [];
  let image = 0;
  const context = () => ({ crop() {}, resize() {}, renderAsync: async () => ({ width:3000, height:4000, saveAsync: async () => { const uri=`file:///cache/crop-${++image}.jpg`; created.push(uri); return {uri}; } }) });
  const { captureIdentityDocument } = load("identityCapture", {
    "expo-file-system/legacy": { documentDirectory:"file:///documents/", makeDirectoryAsync: async () => {}, copyAsync: async ({to}) => created.push(to) },
    "expo-image-manipulator": { ImageManipulator:{manipulate:context}, SaveFormat:{JPEG:"jpeg"} },
    "@infinitered/react-native-mlkit-text-recognition": { recognizeText: async () => { if(failOcr) throw Error("OCR failed"); return {}; } },
    "./idDate": { extractIdentityFromOcr:()=>({name:"환자", birthDate:"19800101", gender:"남성"}), findIdentityRegion:()=>({left:100, top:100, right:1000, bottom:500}), findNameLineFrame:()=>({left:100, top:100, right:500, bottom:150}), nameFromLineCrop:()=>"환자", voteName:()=>"환자" },
  });
  const run = () => captureIdentityDocument("file:///cache/raw.jpg", {width:300,height:600}, {x:30,y:150,width:240,height:150}, async value => {
    events.push("commit");
    if(failCommit) throw Error("storage failed");
    assert.ok(created.includes(value.document.uri));
  }, async uris => { events.push("cleanup"); cleaned.push(...uris); });
  return {run, created, cleaned, events};
}
test("OCR registers the document before cleaning originals and all focused crops", async () => {
  const f=fixture(); const value=await f.run();
  assert.deepEqual(f.events,["commit","cleanup"]);
  assert.ok(f.cleaned.includes("file:///cache/raw.jpg"));
  assert.equal(f.cleaned.includes(value.document.uri),false);
  for(const uri of f.created.filter(uri=>uri!==value.document.uri)) assert.ok(f.cleaned.includes(uri),uri);
  assert.equal(value.document.name,"환자");
});
for(const failure of ["failCommit", "failOcr"]) test(`${failure} cleans the unregistered ID image and temporary originals`, async () => {
  const f=fixture({[failure]:true}); await assert.rejects(f.run());
  assert.ok(f.cleaned.includes("file:///cache/raw.jpg"));
  for(const uri of f.created) assert.ok(f.cleaned.includes(uri),uri);
});
