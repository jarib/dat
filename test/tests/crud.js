var path = require('path')
var concat = require('concat-stream')
var buff = require('multibuffer')
var bops = require('bops')
var protobuf = require('protocol-buffers')
var docUtils = require(path.join(__dirname, '..', '..', 'lib', 'document'))

module.exports.rowKeys = function(test, common) {
  test('rowKeys returns correctly formatted keys', function(t) {
    var sep = '\xff'
    
    var keys = {
      change: 's',
      data: 'd',
      version: 'r',
      cur: 'c'
    }
    
    var a = docUtils.rowKeys(keys, sep, 'foo', '1', '4')
    t.deepEqual(a, { row: 'ÿdÿfooÿ01', change: 'ÿsÿ04', cur: "ÿcÿfoo" })
    
    t.end()
  })
}

module.exports.decodeKey = function(test, common) {
  test('decodeKey parses key format correctly', function(t) {
    var key = 'ÿdÿfooÿ01'
    var obj = docUtils.decodeKey(key)
    var expected = {
      key: 'foo',
      version: 1
    }
    t.deepEqual(obj, expected)
    t.end()
  })
}

module.exports.putJson = function(test, common) {
  test('.put json', function(t) {
    common.getDat(t, function(dat, done) {
      dat.put({"foo": "bar"}, function(err, doc) {
        if (err) throw err
        var cat = dat.createValueStream()
    
        cat.pipe(concat(function(data) {
          t.equal(data.length, 1)
          t.equal(data[0].foo, "bar")
          setImmediate(done)
        }))
      })
    })
  })
}

module.exports.putWeirdKeys = function(test, common) {
  test('key starting + ending with .', function(t) {
    common.getDat(t, function(dat, done) {
      dat.put(".error.", {"foo": "bar"}, function(err, doc) {
        if (err) throw err
        var cat = dat.createValueStream()
        cat.pipe(concat(function(data) {
          t.equal(data.length, 1)
          t.equal(data[0]['foo'], "bar")
          setImmediate(done)
        }))
      })
    })
  })
}

module.exports.putJsonSetVersion = function(test, common) {
  test('.put json at specific version', function(t) {
    common.getDat(t, function(dat, done) {
      dat.put({"foo": "bar", version: 5}, function(err, doc) {
        if (err) throw err
        var cat = dat.createValueStream()
    
        cat.pipe(concat(function(data) {
          t.equal(data.length, 1)
          t.equal(data[0].version, 5)
          setImmediate(done)
        }))
      })
    })
  })
}

module.exports.putJsonPrimary = function(test, common) {
  test('.put json w/ primary key option', function(t) {
    common.getDat(t, function(dat, done) {
      dat.put({"foo": "bar"}, {primary: 'foo'}, function(err, doc) {
        if (err) throw err
        dat.get('bar', function(err, data) {
          t.notOk(err, 'no err')
          t.equal(data.foo, "bar")
          setImmediate(done)
        })
      })
    })
  })
}

module.exports.updateJson = function(test, common) {
  test('.put and then update json', function(t) {
    common.getDat(t, function(dat, done) {
      dat.put("foo", {bar: 'baz'}, function(err, doc) {
        if (err) throw err
        t.ok(doc.version, 'should return doc w/ version')
        dat.put("foo", {bar: 'baz'}, function(err, doc2) {
          t.ok(err, 'should err')
          t.notOk(doc2, "should not return data")
          dat.put(doc, function(err, doc3) {
            t.notOk(err, 'no err')
            t.equals(doc3.version, 2, 'should be version 2')
            setImmediate(done)
          })
        })
      })
    })
  })
}

module.exports.forceOption = function(test, common) {
  test('.put and then force update json', function(t) {
    common.getDat(t, function(dat, done) {
      dat.put("foo", {bar: 'baz'}, function(err, doc) {
        if (err) throw err
        dat.put("foo", {bar: 'baz'}, {"force": true}, function(err, doc2) {
          t.notOk(err, 'no err')
          t.equals(doc2.version, 2, 'should be at version 2')
          setImmediate(done)
        })
      })
    })
  })
}

module.exports.multiplePutJson = function(test, common) {
  test('.put same json multiple times (random key generation)', function(t) {
    common.getDat(t, function(dat, done) {
      dat.put({"foo": "bar"}, function(err) {
        if (err) throw err
        dat.put({"foo": "bar"}, function(err) {
          if (err) throw err
          var cat = dat.createValueStream()
    
          cat.pipe(concat(function(data) {
            t.equal(data.length, 2)
            t.equal(data[0].foo, "bar")
            t.equal(data[1].foo, "bar")
            done()
          }))
        })
      })
    })
  })
}


module.exports.putBuff = function(test, common) {
  test('.put buff', function(t) {
    common.getDat(t, function(dat, done) {
      var schema = protobuf([{name:'foo', type:'string'}]);
      var row = schema.encode({foo:'bar'});
    
      dat.put(row, {columns: schema.toJSON()}, function(err) {
        if (err) throw err
        var cat = dat.createValueStream()
    
        cat.pipe(concat(function(data) {
          t.equal(data.length, 1)
          t.equal(data[0].foo, "bar")
          done()
        }))
      })
    })
  })
}

module.exports.deleteRow = function(test, common) {
  test('delete row', function(t) {
    common.getDat(t, function(dat, done) {
      dat.put({"foo": "bar"}, function(err, doc) {
        if (err) throw err
        dat.delete(doc.key, function(err) {
          t.false(err, 'should delete okay')
          dat.get(doc.key, function(err, doc) {
            t.true(err, 'doc should now be not found')
            t.false(doc, 'doc should be null')
            var cat = dat.createValueStream()
            
            cat.pipe(concat(function(data) {
              t.equal(data.length, 0, 'should return no data')
              setImmediate(done)
            }))
          })
        })
      })
    })
  })
}

module.exports.getAtVersion = function(test, common) {
  test('get row at specific version', function(t) {
    common.getDat(t, function(dat, done) {
      dat.put({"foo": "bar"}, function(err, doc) {
        if (err) throw err
        var ver1 = doc.version
        doc.pizza = 'taco'
        dat.put(doc, function(err, doc) {
          t.false(err)
          if (!doc) doc = {}
          dat.get(doc.key, { version: ver1 }, function(err, docAtVer) {
            t.false(err, 'no err')
            if (!docAtVer) docAtVer = {}
            t.equal(docAtVer.pizza, undefined, 'doc is version 1')
            setImmediate(done)
          })
        })
      })
    })
  })
}

module.exports.keepTotalRowCount = function(test, common) {
  test('dat has a getRowCount cmd', function(t) {
    common.getDat(t, function(dat, done) {
      t.equal(typeof dat.getRowCount, 'function')
      setImmediate(done)
    })
  })

  test('dat initializes with 0 rows', function(t) {
    common.getDat(t, function(dat, done) {
      t.equal(dat.getRowCount(), 0)
      setImmediate(done)
    })
  })

  test('inc row count on put', function(t) {
    common.getDat(t, function(dat, done) {
      dat.put({"foo": "bar"}, function(err, doc) {
        if (err) throw err
        t.equal(dat.getRowCount(), 1)
        setImmediate(done)
      })
    })
  })

  test('dec row count on del', function(t) {
    common.getDat(t, function(dat, done) {
      dat.put({"foo": "bar"}, function(err, doc) {
        if (err) throw err
        t.equal(dat.getRowCount(), 1)
        dat.delete(doc.key, function(err) {
          if (err) throw err
          t.equal(dat.getRowCount(), 0)
          setImmediate(done)
        })
      })
    })
  })

  test('do not change row count on update', function(t) {
    common.getDat(t, function(dat, done) {
      dat.put("foo", {bar: 'baz'}, function(err, doc) {
        if (err) throw err
        t.equal(dat.getRowCount(), 1)
        dat.put(doc, function(err, doc2) {
          t.notOk(err, 'should not err')
          t.equal(dat.getRowCount(), 1)
          setImmediate(done)
        })
      })
    })
  })

  test('persist the row count', function(t) {
    common.getDat(t, function(dat, done) {
      dat.put({"foo": "bar"}, function(err, doc) {
        dat.put({"bar": "foo"}, function(err, doc) {
          dat.storage.getRowCount(function(err, val) {
            if (err) throw err
            t.equal(val, 2)
            t.equal(dat.getRowCount(), val)
            setImmediate(done)
          });
        })
      })
    })
  })
}

module.exports.all = function (test, common) {
  module.exports.rowKeys(test, common)
  module.exports.decodeKey(test, common)
  module.exports.putJson(test, common)
  module.exports.putWeirdKeys(test, common)
  module.exports.putJsonSetVersion(test, common)
  // module.exports.putJsonPrimary(test, common)
  module.exports.updateJson(test, common)
  module.exports.forceOption(test, common)
  module.exports.multiplePutJson(test, common)
  module.exports.putBuff(test, common)
  module.exports.deleteRow(test, common)
  module.exports.getAtVersion(test, common)
  module.exports.keepTotalRowCount(test, common)
}
