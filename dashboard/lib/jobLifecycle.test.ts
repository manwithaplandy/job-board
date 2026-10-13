import {expect,test} from "vitest";
import {parseDemandResult,parseRequestBody} from "./jobLifecycle";

test("ready requires the exact durable version and usable snapshot",()=>{
  const row={id:"d",job_id:"j",kind:"prepare",status:"ready"};
  for(const value of [null,[],1,"{}",row,{...row,job_version_id:"v"},{...row,job_version_id:"v",description_snapshot:3}]) expect(parseDemandResult(value)).toBeNull();
  expect(parseDemandResult({...row,job_version_id:"v",description_snapshot:"JD",questions_snapshot:"bad"})).toEqual({status:"ready",id:"d",kind:"prepare",versionId:"v",description:"JD",questions:null});
});
test("pending and deferred are honest; malformed request bodies are total",()=>{
  expect(parseDemandResult({id:"d",job_id:"j",kind:"prepare",status:"running"})).toEqual({status:"pending",id:"d"});
  expect(parseDemandResult({id:"d",job_id:"j",kind:"prepare",status:"failed"})).toEqual({status:"deferred",id:"d"});
  for(const value of [null,[],1,"{}",true]) expect(parseRequestBody(value)).toEqual({});
  expect(parseRequestBody({jobId:3})).toEqual({jobId:3});
});
