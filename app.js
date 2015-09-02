var express = require('express'),
  app = express(),
  mysql = require('mysql'),
  bodyParser = require('body-parser'),

  mysqlPool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'user',
    database: 'conquest'
  });

app.use(bodyParser.json());

// To use with mirth 
/*
app.use(function(req, res, next) {
	if (req.is('text/*')) {
		req.text = '';
		req.setEncoding('utf8');
		req.on('data', function(chunk) {
			req.text += chunk;
		});
		req.on('end', next);
	}
	else {
		next();
	}
});
*/

app.get('/', function(req, res) {
  res.status("200").send('ConquestRestAPI is running...');
});

app.get('/api/patients', function(req, res) {
  //Return patient list
  res.status("200").send('Return patient list');
});

app.post('/api/patients', function(req, res) {
  //Create patient
  mysqlPool.getConnection(function(err, connection) {
    if (err) {
      console.log(err);
      res.status("500").send(err.toString());
    } else {
      connection.query('INSERT INTO DICOMWorkList SET ?', req.body, function(err, result) {
        if (err) {
          console.log(err);
          res.status("500").send(err.toString());
        } else {
          res.status("201").end();
        }
      });
      connection.release();
    }
  });
});

app.get('/api/patients/:Id', function(req, res) {
  //Return patient data
});
app.put('/api/patients/:Id', function(req, res) {
  //Update patient data
});
app.delete('/api/patients/:Id', function(req, res) {
  //Delete patient
});


app.listen(8080, '192.168.1.166');
