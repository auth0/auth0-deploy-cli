import LocalStorage from 'node-storage';

export default class {
    constructor(fileName) {
        this.local = new LocalStorage(fileName);
    }

    read() {
        var me = this;
        return new Promise(function(resolve,reject) {
            var data = me.local.get('context') || {};
            resolve(data);
        });
    }

    write(value) {
        this.local.put('context',value);
    }
}