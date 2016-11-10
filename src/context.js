import * as fs from 'fs';

export default class {
    constructor(fileName) {
        this.fileName = fileName;
    }

    init() {
        var me = this;
        /* First parse the input file */
        return new Promise(function(resolve,reject) {
            resolve(JSON.parse(fs.readFileSync(me.fileName)));
        }).then(
            /* Map just the data that is in the config file */
            (data) => {
                me.pages = data.pages || {};
                me.rules = data.rules || {};
                me.databases = data.databases || [];
            }
        );
    }
}