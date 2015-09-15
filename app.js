var express = require('express'),
  app = express(),
  mysql = require('mysql'),
  bodyParser = require('body-parser'),
  gcloud = require('gcloud'),
  fs = require('fs'),
  process = require('child_process'),

  gcs = gcloud.storage({
    keyFilename: './CloudDicom-1f0d0f461c12.json',
    projectId: 'axiomatic-math-616'
  }),
  bucket = gcs.bucket('dicom'),

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

//
//
//Routes to handles worklist
app.get('/', function(req, res) {
  res.status("200").send('ConquestRestAPI is running...');
});

app.get('/v1/patients', function(req, res) {
  //Return patient list
  res.status("200").send('Return patient list');
});

app.post('/v1/patients', function(req, res) {
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

app.get('/v1/patients/:Id', function(req, res) {
  //Return patient data
});
app.put('/v1/patients/:Id', function(req, res) {
  //Update patient data
});
app.delete('/v1/patients/:Id', function(req, res) {
  //Delete patient
});

//
//
// Routes to handle Forward DICOM
app.post('/v1/dicoms/', function(req, res) {
  console.log(req.body.file);
  var ls = process.spawn('./dcmj2pnm', ["+oj",'pano.dcm']);
  var remoteWriteStream = bucket.file('pano.jpg').createWriteStream();
  ls.stdout.pipe(remoteWriteStream);
  ls.stdout.on('end', function() {
    res.status("200").end();
  });
});

app.listen(8080, '192.168.1.166');
