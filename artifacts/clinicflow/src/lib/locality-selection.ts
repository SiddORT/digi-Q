export type LocalitySelection = { key: string; segment: string; offset: number };
/** Offsets are provenance, not substring matches. An edited segment loses provenance and is never removed. */
export function reconcileLocalities(address: string, selected: LocalitySelection[] = []) {
  return selected.filter(item => address.slice(item.offset, item.offset + item.segment.length) === item.segment);
}
export function toggleLocality(address: string, selected: LocalitySelection[], key: string, name: string) {
  const valid = reconcileLocalities(address, selected);
  const prior = valid.find(item => item.key === key);
  if (prior) {
    const end = prior.offset + prior.segment.length;
    return { address: address.slice(0, prior.offset) + address.slice(end), localities: valid.filter(item => item !== prior).map(item => ({ ...item, offset: item.offset >= end ? item.offset - prior.segment.length : item.offset })) };
  }
  // Manual exact comma-delimited segments remain manual, never claimed by the control.
  if (address.split(",").some(segment => segment.trim().toLowerCase() === name.trim().toLowerCase())) return { address, localities: valid };
  const segment = `${address ? ", " : ""}${name}`;
  return { address: address + segment, localities: [...valid, { key, segment, offset: address.length }] };
}
