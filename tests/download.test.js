import {afterEach, expect, test, vi} from 'vitest';
import {download} from '../src/ui/shared.js';

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});

test.each([false,true])('download keeps a connected link and blob alive until deferred cleanup (click throws: %s)',async throws=>{
  vi.useFakeTimers();
  let connected=false;
  const anchor={
    click:vi.fn(()=>{
      expect(connected).toBe(true);
      if(throws)throw new Error('Download blocked');
    }),
    remove:vi.fn(()=>{connected=false;}),
  };
  const append=vi.fn(()=>{connected=true;});
  vi.stubGlobal('document',{createElement:vi.fn(()=>anchor),body:{append}});
  const create=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:backup');
  const revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
  const contents='{"format":"finance-plan-beta"}';
  const run=()=>download('finance-plan-2026-10-30.json',contents);
  if(throws)expect(run).toThrow('Download blocked');else run();
  expect(append).toHaveBeenCalledWith(anchor);
  expect(anchor).toMatchObject({hidden:true,href:'blob:backup',download:'finance-plan-2026-10-30.json'});
  const blob=create.mock.calls[0][0];
  expect(blob.type).toBe('application/json');
  expect(await blob.text()).toBe(contents);
  expect(connected).toBe(true);
  expect(revoke).not.toHaveBeenCalled();
  vi.runAllTimers();
  expect(connected).toBe(false);
  expect(anchor.remove).toHaveBeenCalledOnce();
  expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:backup');
});
