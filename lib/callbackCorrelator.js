var uuid = require('uuid');

module.exports = function() {
  var callbacks = {};

  function argumentArray(args) {
    return [].slice.apply(args);
  }

  return {
    register: function(cb) {
      var cid = uuid();
      callbacks[cid] = cb;
      return cid;
    },

    route: function(correlationId) {
      var callbackArgs = argumentArray(arguments).slice(1);
      var callback = callbacks[correlationId];

      if (!callback) {
        return;
      }

      delete callbacks[correlationId];

      callback.apply(null, callbackArgs);
    }
  };
};
