var express = require('express'),
app = express(),
mysql = require('mysql');

mysqlPool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'user',
  database: 'conquest'
});

app.get('/', function(req, res){
  res.send('ConquestRestAPI is running...');
});

app.get('/api/patients', function(req, res){
  res.send('hello world');
});

app.post('/api/patients', function(req, res){
  res.send('hello world');
});

app.get('/api/patients/:Id', function(req, res){
  res.send('hello world');
});
app.put('/api/patients/:Id', function(req, res){
  res.send('hello world');
});
app.delete('/api/patients/:Id', function(req, res){
  res.send('hello world');
});


app.listen(8080, '127.0.0.1');
