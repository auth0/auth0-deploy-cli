'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _nodeStorage = require('node-storage');

var _nodeStorage2 = _interopRequireDefault(_nodeStorage);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _class = function () {
    function _class(fileName) {
        _classCallCheck(this, _class);

        this.local = new _nodeStorage2.default(fileName);
    }

    _createClass(_class, [{
        key: 'read',
        value: function read() {
            var me = this;
            return new Promise(function (resolve, reject) {
                var data = me.local.get('context') || {};
                resolve(data);
            });
        }
    }, {
        key: 'write',
        value: function write(value) {
            this.local.put('context', value);
        }
    }]);

    return _class;
}();

exports.default = _class;