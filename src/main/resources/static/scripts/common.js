
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
    var closest = minMax2DArray(arr).max;
    for(var i = 0; i < arr.length; i++){
        if(arr[i] >= closestTo && arr[i] < closest) closest = arr[i];
    }
    return closest;
}

function minMax2DArray(arr) {
  var max = Number.MIN_VALUE,
      min = Number.MAX_VALUE;
  arr.forEach(function(e) {
    if (max < e) { max = e; }
    if (min > e) { min = e; }
  });
  return {max: max, min: min};
}

function getStepSizeFromRange(range, numSteps) {
  var multiplier = 1;
  //If range is smaller than 1.0 find the divisor
  while (range > 0 && range * multiplier < 1) {
    multiplier *= 10;
  }
  return (1.0 / multiplier) / numSteps;
}

function getPrecisionFromFloat(value) {
  var strVal = value + "";
  if (strVal.indexOf(".") > -1){
    return strVal.split(".")[1].length;
  } else {
    return Math.pow(10, -strVal.length);
  }
}

function rebinData(x, y, dx_new, method){

  // Rebin some data to an arbitrary new data resolution. Either sum
  // the data points in the new bins or average them.
  if (isNull(method)) { method = "sum"; }

  if (x.length < 2 || x.length != y.length) {
      return {x: x, y: y};
  }

  if (dx_new < x[1] - x[0]) {
    throw new Error("New frequency resolution must be larger than old frequency resolution.");
  }

  var newX = [];
  var newY = [];
  var initX = x[0];
  var sumDx = x[0];
  var sumDy = 0;
  var sumCount = 1;
  for (i in x) {
    if (i > 0){
      var dx= x[i] - x[i - 1];
      sumDx += dx;
      sumDy += y[i];
      sumCount ++;
    }

    if (sumDx >= dx_new) {
      if (method == 'sum') {
        newY.push(sumDy);
      } else if (method == 'avg') {
        newY.push(sumDy / sumCount);
      } else {
        throw new Error("Unknown binning method: " + method);
      }
      newX.push((initX + x[i]) / 2);
      sumDx = 0;
      sumDy = 0;
      sumCount = 0;
      initX = x[i];
    }

  }

  return {x: newX, y: newY};
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

function showLoadFile(onLoadFn, fileExtension) {
  var input = $('<input type="file" id="load-input" />');
  input.on('change', function (e) {
    if (e.target.files.length == 1) {
      var file = e.target.files[0];
      if (isNull(fileExtension) || file.name.endsWith(fileExtension)){
        var reader = new FileReader();
        reader.onload = function (e) { onLoadFn (e, file) };
        reader.readAsText(file);
      } else {
        onLoadFn (null, file);
      }
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
