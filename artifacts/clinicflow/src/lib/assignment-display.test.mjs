import assert from "node:assert/strict";
import test from "node:test";
import { assignmentDisplay } from "./assignment-display.ts";

const success = { isPending:false, isFetching:false, isError:false, isSuccess:true };
test("only an idle successful zero can explain missing assignments", () => {
  assert.equal(assignmentDisplay({...success,data:{total:0}}), "empty");
  assert.equal(assignmentDisplay({...success,data:{total:1}}), "ready");
  assert.equal(assignmentDisplay({...success,data:{total:2}}), "ready");
  assert.equal(assignmentDisplay({...success,isFetching:true,data:{total:0}}), "checking");
  assert.equal(assignmentDisplay({...success,isPending:true,isSuccess:false}), "checking");
  assert.equal(assignmentDisplay({...success,isSuccess:false,isError:true,data:{total:0}}), "error");
  assert.equal(assignmentDisplay({...success,isSuccess:false,isError:true}), "error");
});
