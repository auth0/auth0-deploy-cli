import LocalStorage from 'node-storage';

export default class {
  constructor(fileName) {
    this.local = new LocalStorage(fileName);
  }

  read() {
    const me = this;
    return new Promise((resolve) => {
      const data = me.local.get('context') || {};
      resolve(data);
    });
  }

  write(value) {
    this.local.put('context', value);
  }
}
