/**
 * Created by mostekcm on 9/7/16.
 */

var MarkdownProcessor = require("./../MarkdownProcessor");
var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
var expect = chai.expect;


describe('MarkdownProcessor', function () {
    it('process a header', function () {
        var lines = [
            '# header 1',
            '## header 2',
            '### header 3  ',
            '####  header 4',
            '##### header 5'
        ];
        var targetLines = [
            '===== header 1 =====',
            '==== header 2 ====',
            '=== header 3 ===',
            '== header 4 ==',
            '= header 5 ='
        ];
        var mp = new MarkdownProcessor();
        lines.forEach(function (line) {
            mp.processLine(line).then(function () {
                return;
            });
        });
        return mp.finish().then(function (dokuLines) {
            expect(dokuLines).to.deep.equal(targetLines);
        });
    });

    it('process a simple list', function () {
        var lines = [
            '1. li 1',
            '2. li 2',
            '3. li 3  ',
            '3.  header 4',
            '1. header 5'
        ];
        var targetLines = [
            '  - li 1',
            '  - li 2',
            '  - li 3  ',
            '  - header 4',
            '  - header 5'
        ];
        var mp = new MarkdownProcessor();
        lines.forEach(function (line) {
            mp.processLine(line).then(function () {
                return;
            });
        });
        return mp.finish().then(function (dokuLines) {
            expect(dokuLines).to.deep.equal(targetLines);
        });
    });

    it('process a space before a list', function () {
        var lines = [
            'stuff',
            '',
            '1. li 1',
            '2. li 2',
            '3. li 3  ',
            '3.  header 4',
            '1. header 5'
        ];
        var targetLines = [
            'stuff',
            '  - li 1',
            '  - li 2',
            '  - li 3  ',
            '  - header 4',
            '  - header 5'
        ];
        var mp = new MarkdownProcessor();
        lines.forEach(function (line) {
            mp.processLine(line).then(function () {
                return;
            });
        });
        return mp.finish().then(function (dokuLines) {
            expect(dokuLines).to.deep.equal(targetLines);
        });
    });

    it('process a nested list', function () {
        var lines = [
            ' 1. li 1',
            '   2. li 2',
            ' 3. li 3  ',
            '   3.  li 4',
            '      1. li 5',
            '      1. li 5',
            '   3.  li 4',
            '      1. li 5',
            '      1. li 5',
            '  3.  li 4',
            '      1. li 5',
            '      1. li 5',
            '3.  li 4 *stuff*'
        ];
        var targetLines = [
            '  - li 1',
            '    - li 2',
            '  - li 3  ',
            '    - li 4',
            '      - li 5',
            '      - li 5',
            '    - li 4',
            '      - li 5',
            '      - li 5',
            '    - li 4',
            '      - li 5',
            '      - li 5',
            '  - li 4 *stuff*'
        ];
        var mp = new MarkdownProcessor();
        lines.forEach(function (line) {
            mp.processLine(line).then(function () {
                return;
            });
        });
        return mp.finish().then(function (dokuLines) {
            expect(dokuLines).to.deep.equal(targetLines);
        });
    });

    it('process code blocks in a list', function () {
        var lines = [
            '7. `cd /var/auth0/db/restore`',
            '  8. `tar xf /tmp/backup.tar.gz`',
            '  8. `mongorestore --db auth0 --drop --username auth0 --host a0/a0-1:27017 ./auth0 -p \'PASSWORD_FOR_DB\'`. Remember if this is a new instance, the password is still default. You can view the password in the `/etc/auth0.config` connection string.',
            '  ```',
            '    #stopping these processes is not required, but speeds up the operation a lot since these processes use a lot of CPU when they can\'t connect.',
            '    stop auth0',
            '    stop auth0-users',
            '    stop auth0-manage',
            '    stop auth0-notifications',
            '    stop auth0-docs',
            '    stop auth0-api2',
            '  ```',
            '7. Restart services if stopped during restore.',
            '',
            ' ```',
            '    start auth0',
            '    start auth0-users',
            '    start auth0-manage',
            '    start auth0-notifications',
            '    start auth0-docs',
            '    start auth0-api2',
            '    ```',
            '6. If you are running on aws, then you will need to run the `changehostname` script to a0-1',
            '7. edit `/etc/auth0.config`, and update the connection string with the password for the **restored** database.   '
        ];
        var targetLines = [
            '  - `cd /var/auth0/db/restore`',
            '    - `tar xf /tmp/backup.tar.gz`',
            '    - `mongorestore --db auth0 --drop --username auth0 --host a0/a0-1:27017 ./auth0 -p \'PASSWORD_FOR_DB\'`. Remember if this is a new instance, the password is still default. You can view the password in the `/etc/auth0.config` connection string.<code>',
            '    #stopping these processes is not required, but speeds up the operation a lot since these processes use a lot of CPU when they can\'t connect.',
            '    stop auth0',
            '    stop auth0-users',
            '    stop auth0-manage',
            '    stop auth0-notifications',
            '    stop auth0-docs',
            '    stop auth0-api2',
            '</code>',
            '  - Restart services if stopped during restore.<code>',
            '    start auth0',
            '    start auth0-users',
            '    start auth0-manage',
            '    start auth0-notifications',
            '    start auth0-docs',
            '    start auth0-api2',
            '</code>',
            '  - If you are running on aws, then you will need to run the `changehostname` script to a0-1',
            '  - edit `/etc/auth0.config`, and update the connection string with the password for the **restored** database.   '
        ];
        var mp = new MarkdownProcessor();
        lines.forEach(function (line) {
            mp.processLine(line).then(function () {
                return;
            });
        });
        return mp.finish().then(function (dokuLines) {
            expect(dokuLines).to.deep.equal(targetLines);
        });
    });

    it('process code blocks with language', function () {
        var lines = [
            '  ``` bash',
            '# stopping these processes is not required, but speeds up the operation a lot since these processes use a lot of CPU when they can\'t connect.',
            '    stop auth0',
            '    stop auth0-users',
            '    stop auth0-manage',
            '    stop auth0-notifications',
            '    stop auth0-docs',
            '    stop auth0-api2',
            '  ```',

        ];
        var targetLines = [
            '<code bash>',
            '# stopping these processes is not required, but speeds up the operation a lot since these processes use a lot of CPU when they can\'t connect.',
            '    stop auth0',
            '    stop auth0-users',
            '    stop auth0-manage',
            '    stop auth0-notifications',
            '    stop auth0-docs',
            '    stop auth0-api2',
            '</code>',
        ];
        var mp = new MarkdownProcessor();
        lines.forEach(function (line) {
            mp.processLine(line).then(function () {
                return;
            });
        });
        return mp.finish().then(function (dokuLines) {
            expect(dokuLines).to.deep.equal(targetLines);
        });
    });

});