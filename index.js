const app = require('express')();
const config = require('ez-config').get();
const ldap = require('ldapjs').createClient(config.ldap.server);
const cors = require('cors')();

var payload = {
  rows: null,
  corpus: null,
  init: function(corpus, item) {
    this.rows = [];
    if (!item) {
      this.rows.push({key:[corpus], value:{name:corpus}});
    }
    this.corpus = corpus;
  },
  push: function(entry) {
    var key = [this.corpus, entry[config.ldap.id]];
    for (var attribute in entry) {
      if (!(attribute in config.reserved.attributes || entry[attribute] in config.reserved.values)) {
        var value = {};
        if(config.hypertopic[attribute]){
          for(var indexAttribute in config.hypertopic[attribute]){
            value[config.hypertopic[attribute][indexAttribute]] = entry[attribute];
          }
        }else{
          value[attribute] = entry[attribute];
        }
        this.rows.push({
          key: key,
          value: value
        });
      }
    }
  },
  send: function(response) {
    response.json({rows: this.rows});
  }
};

function sendItems(request, response) {
  var filter =  '(' + config.ldap.class + '=' + request.params.corpus + ')';
  if (request.params.item) {
    filter = '(&' + filter + '('+ config.ldap.id + '=' + request.params.item + '))';
  }
  var options = {
    scope: 'sub',
    filter: filter,
    attributes: config.ldap.attributes
  };
  payload.init(request.params.corpus, request.params.item);
  ldap.search(config.ldap.base, options, function(err, ldap_response) {
    ldap_response.on('searchEntry', function(entry) {
      payload.push(entry.object);
    });
    ldap_response.on('error', function(err) {
      console.error('error: ' + err.message);
    });
    ldap_response.on('end', function() {
      payload.send(response);
    });
  });
}

function sendEmpty(request, response){
  response.json({rows: []});
}

function sendUser(request, response){
  response.json({rows: [{
    key:'annuaire',
    value:{"corpus":{"id":"student", "name":"Étudiants"}}
  }]});
}

app.use(cors)
.get(['/corpus/:corpus', '/item/:corpus/:item'], sendItems)
.get('/viewpoint/:viewpoint', sendEmpty)
.get('/user/annuaire', sendUser);

app.listen(config.port);
console.log('Server running on port ' + config.port);
