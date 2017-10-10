
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

function truncateText(string, maxLength){
   if (string.length > maxLength)
      return string.substring(0,maxLength)+'...';
   else
      return string;
};

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

//Transposes an array: [[1,2,3], [4,5,6], [7,8,9]] -> [[1, 4, 7], [2, 5, 8], [3, 6, 9]]
function transposeArray(a) {
    return Object.keys(a[0]).map(function(c) {
        return a.map(function(r) { return r[c]; });
    });
}

//Extracts an array from csv text contents
function extractDatafromCSVContents(contents) {
  var data = [];

  if (contents.length > 0) {
    var lines = contents.split("\n");
    logInfo("Extracting CSV data, N lines: " + lines.length);

    for (i in lines){
      var line = lines[i];
      if (line.length > 0){
        var strData = line.split(",");
        if (strData.length > 2){
          lineData = [];
          for (j in strData){
            var value = strData[j].trim();
            if (jQuery.isNumeric(value)){
              value = parseFloat(value);
            }
            lineData.push(value);
          }
          data.push(lineData);
        }
      }
    }
  }

  return data;
}

// ------- COLOR FUNCTIONS ---------
function RGBToHex (rgb) {
  var hex = [
    rgb.r.toString(16),
    rgb.g.toString(16),
    rgb.b.toString(16)
  ];
  $.each(hex, function (nr, val) {
    if (val.length == 1) {
      hex[nr] = '0' + val;
    }
  });
  return hex.join('');
}

function HexToRGB (hex) {
  var hex = parseInt(((hex.indexOf('#') > -1) ? hex.substring(1) : hex), 16);
  return {r: hex >> 16, g: (hex & 0x00FF00) >> 8, b: (hex & 0x0000FF)};
}

function RGBToRGBStr (rgb) {
  return "rgb(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ")";
}

function HexAndAlphaToRGBAStr (hex, alpha) {
  var rgb = HexToRGB(hex);
  return "rgba(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ", " + alpha + ")";
}

function RGBAStrToRGBA (rgbaStr) {
  var rgba = rgbaStr.replace("rgba(", "").replace(")", "").replace(/\ /g,'').split(",");
  return {r: parseInt(rgba[0]), g: parseInt(rgba[1]), b: parseInt(rgba[2]), a: parseFloat(rgba[3])};
}

function RGBAStrToHex (rgbaStr) {
  return RGBToHex(RGBAStrToRGBA(rgbaStr));
}

function getRandomColor () {
  return '#'+ fillWithZeros(Math.floor(Math.random()*16777215).toString(16), 6);
}

function getColorScale (colorScaleConfig) {
  var colorscale = [];
  var numColors = colorScaleConfig.numColors;
  var x0 = colorScaleConfig.x0;
  var y0 = colorScaleConfig.y0;
  var m = Math.pow(colorScaleConfig.m * 4, 3);
  var color1 = HexToRGB(colorScaleConfig.color1);
  var color2 = HexToRGB(colorScaleConfig.color2);
  var colorDiff = {r: 0, g: 0, b: 0};
  colorDiff.r = color1.r - color2.r;
  colorDiff.g = color1.g - color2.g;
  colorDiff.b = color1.b - color2.b;

  for (i = 0; i <= 1.0; i+=(1.0/numColors)) {
    var c_ratio = Math.max(Math.min(((i - y0)*m + x0), 1.0), 0.0);
    var color = HexToRGB("#000000");
    color.r = color1.r - Math.floor(colorDiff.r * c_ratio);
    color.g = color1.g - Math.floor(colorDiff.g * c_ratio);
    color.b = color1.b - Math.floor(colorDiff.b * c_ratio);
    var ratio = "" + fixedPrecision(i, 2);
    colorscale.push([((ratio.length == 1) ? ratio + ".0" : ratio), RGBToRGBStr(color)]);
  }
  return colorscale;
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

function saveRawToFile(filename, text) {
  var encodedUri = encodeURI(text);
  var link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  link.click();
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
