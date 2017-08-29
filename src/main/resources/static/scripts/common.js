
// ------- MATH FUNCTIONS -------

function isNull (value) {
  return (value === undefined) || (value == null);
}

function isInt(n) {
   return n % 1 === 0;
}

function fixedPrecision(value, precision) {
   return (precision > 0) ? parseFloat(value.toFixed(precision)) : Math.floor(value);
}

function fillWithZeros(num, length) {
  num = ""+num;
  while(num.length < length) num = "0"+num;
  return num;
}

function closest(arr, closestTo){
    var closest = Math.max.apply(null, arr);
    for(var i = 0; i < arr.length; i++){
        if(arr[i] >= closestTo && arr[i] < closest) closest = arr[i];
    }
    return closest;
}

function getStepSizeFromRange(range, numSteps) {
  var multiplier = 1;
  //If range is smaller than 1.0 find the divisor
  while (range > 0 && range * multiplier < 1) {
    multiplier *= 10;
  }
  return (1.0 / multiplier) / numSteps;
}


// ------- CLIPBOARD AND FILE MEHTODS -------
function copyToClipboard(text) {
  const {clipboard} = require('electron');
  clipboard.writeText(text);
  showMsg("Copied to clipboard:", text);
}

function saveToFile (filename, contents) {
  var a = document.createElement("a");
  var file = new Blob([contents], {type: 'text/plain'});
  a.href = URL.createObjectURL(file);
  a.download = filename;
  a.click();
}

function showLoadFile(onLoadFn) {
  var input = $('<input type="file" id="load-input" />');
  input.on('change', function (e) {
    if (e.target.files.length == 1) {
      var file = e.target.files[0];
      var reader = new FileReader();
      reader.onload = function (e) { onLoadFn (e, file) };
      reader.readAsText(file);
    }
   });
   input.click();
}


// ------- CONNECTIVITY MEHTODS -------
function UrlExists(url, cb){
    jQuery.ajax({
        url:      url,
        dataType: 'text',
        type:     'GET',
        complete:  function(xhr){
            if(typeof cb === 'function')
               cb.apply(this, [xhr.status]);
        }
    });
}
