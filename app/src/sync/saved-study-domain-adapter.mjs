import {
  createSavedStudyConflictCopy,
  fromRemoteSavedStudyObject,
  prepareLocalConflictWinner,
  sameRemoteSavedStudyObject,
  toRemoteSavedStudyObject,
} from './domain.mjs';

export function createSavedStudySyncDomainAdapter({
  syncPort,
  clock = () => new Date(),
} = {}) {
  if (!syncPort?.listAll || !syncPort?.getById || !syncPort?.applyRemote || !syncPort?.activate) {
    throw new TypeError('Saved Study sync requires the canonical application port');
  }
  async function ownerRef() {
    return (await syncPort.activate()).ownerRef;
  }
  return Object.freeze({
    domain: 'saved_study_objects',
    supports: (object) => ['hand', 'spot'].includes(object?.kind),
    async listLocalObjects() {
      return (await syncPort.listAll()).filter((object) => ['hand', 'spot'].includes(object.kind));
    },
    getLocalObject: (id) => syncPort.getById(id),
    serialize: toRemoteSavedStudyObject,
    same: sameRemoteSavedStudyObject,
    async applyRemote(document, options = {}) {
      const object = fromRemoteSavedStudyObject(document, await ownerRef());
      return syncPort.applyRemote(object, options);
    },
    async prepareLocalWinner(localObject, remoteDocument) {
      return prepareLocalConflictWinner(localObject, remoteDocument, {
        ownerRef: await ownerRef(), clock,
      });
    },
    async createConflictCopy(localObject, id) {
      const object = createSavedStudyConflictCopy(localObject, {
        id, ownerRef: await ownerRef(), clock,
      });
      await syncPort.saveObject(object);
      return object;
    },
  });
}
