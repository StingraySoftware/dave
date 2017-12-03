//Phaseogram plot

function PhPlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable) {

  var currentObj = this;

  Plot.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable);

  this.ph_opts = {};
  this.ph_opts.nph = { default:64, min:1, max: 256}; //Number of phase bins of the phaseogram
  this.ph_opts.nt = { default:128, min:1, max: 512}; //Number of time bins of the phaseogram

  this.plotConfig.f = 0;
  this.plotConfig.nph = this.ph_opts.nph.default;
  this.plotConfig.nt = this.ph_opts.nt.default;
  this.plotConfig.fdot = 0;
  this.plotConfig.fddot = 0;
  this.plotConfig.binary_params = null;
  //this.plotConfig.binary_params = [0, 0, 0]; // [orbital_period, asini, t0]
  this.plotConfig.colorScale = $.extend(true, {}, this.getDefaultPlotlyConfig().DEFAULT_COLORSCALE);

  this.plotConfig.tmp_df = 0;
  this.plotConfig.tmp_fdot = 0;
  this.plotConfig.tmp_fddot = 0;
  this.plotConfig.tmp_binary_params = null;

  this.showLines = false;

  this.btnFullScreen.remove();
  this.btnLoad.remove();

  this.getPlotlyConfig = function (data) {

    var plotDefaultConfig = currentObj.getDefaultPlotlyConfig();
    var plotlyConfig = get_plotdiv_dynamical_spectrum(data[1].values,
                                                  data[2].values,
                                                  data[0].values,
                                                  currentObj.plotConfig.styles.labels[1],
                                                  currentObj.plotConfig.styles.labels[2],
                                                  currentObj.plotConfig.styles.labels[0],
                                                  getColorScale (this.plotConfig.colorScale),
                                                  currentObj.getTitle(),
                                                  currentObj.getDefaultPlotlyConfig());
    plotlyConfig.data[0].type = "heatmap";

    //Calculates and plots the lines
    if (currentObj.showLines && data[2].values.length > 0){
      var pepoch = data[2].values[0];
      var orbital_period = !isNull(currentObj.plotConfig.tmp_binary_params) ? currentObj.plotConfig.tmp_binary_params[0] : 1;
      if (Math.abs(orbital_period) < 0.00001) {
        orbital_period = 0.00001;
      }
      var asini = !isNull(currentObj.plotConfig.tmp_binary_params) ? currentObj.plotConfig.tmp_binary_params[1] : 0;
      var t0 = !isNull(currentObj.plotConfig.tmp_binary_params) ? currentObj.plotConfig.tmp_binary_params[2] : 0;

      var prev_orbital_period = !isNull(currentObj.plotConfig.binary_params) ? currentObj.plotConfig.binary_params[0] : 1;
      var prev_asini = !isNull(currentObj.plotConfig.binary_params) ? currentObj.plotConfig.binary_params[1] : 0;
      var prev_t0 = !isNull(currentObj.plotConfig.binary_params) ? currentObj.plotConfig.binary_params[2] : 0;

      for (ph0 = 0.0; ph0 <= 2.0; ph0 += 0.5) {
        var xData = [];
        var delay0 = null;
        for (j = 0; j < data[2].values.length; j++) {
          var delay = null;
          if (isNull(currentObj.plotConfig.tmp_binary_params)) {
            var t = data[2].values[j] - pepoch;
            delay = (t * currentObj.plotConfig.tmp_df) +
                     (0.5 * Math.pow(t, 2) * currentObj.plotConfig.tmp_fdot) +
                     (1/6 *  Math.pow(t, 3) * currentObj.plotConfig.tmp_fddot);
           } else {
             var new_value = asini * Math.sin(2 * Math.PI * (data[2].values[j] - t0) / orbital_period)
             var old_value = prev_asini * Math.sin(2 * Math.PI * (data[2].values[j] - prev_t0) / prev_orbital_period)
             delay = (new_value - old_value) * currentObj.plotConfig.f
           }
          if (isNull(delay0)){
            delay0 = delay;
          }
          xData.push(ph0 + delay - delay0);
        }
        plotlyConfig.data.push(getLine (xData, data[2].values, plotDefaultConfig.PHASEOGRAM_LINE_COLOR, 1));
      }

      //Fixes xaxis range
      plotlyConfig.layout.xaxis.range = [0.0, 2.0];
    }

    return plotlyConfig;
  }

  this.applySliders = function (){
    if (isNull(this.plotConfig.tmp_binary_params)){
      this.plotConfig.f -= this.plotConfig.tmp_df;
      this.plotConfig.fdot -= this.plotConfig.tmp_fdot;
      this.plotConfig.fddot -= this.plotConfig.tmp_fddot;
    } else {
      this.plotConfig.binary_params = this.plotConfig.tmp_binary_params;
    }
  }

  this.resetFrequecy = function (freq) {
    this.plotConfig.f = freq;
    this.plotConfig.fdot = 0;
    this.plotConfig.fddot = 0;
    this.plotConfig.binary_params = null;
  }

  this.resetTempValues = function () {
    this.plotConfig.tmp_df = 0;
    this.plotConfig.tmp_fdot = 0;
    this.plotConfig.tmp_fddot = 0;
    this.plotConfig.tmp_binary_params = null;
  }

  this.getCoordsFromPlotlyHoverEvent = function (){
    return null;
  }

  this.showAddAnnotationDialog = function (x, y){
    log ("Annotations not supported!, PhPlot id: " + this.id);
  }

  //JUST COPIED FROM DynSpPlot
  this.appendColorScaleToJqElem = function ($jqElem){

    //Creates the color scale controls
    this.colorScale = $('<div class="colorScale smallTextStyle">' +
                          '<h3>Color scale:</h3>' +
                          '<canvas class="colorScaleCanvas"></canvas>' +
                          '<canvas class="colorPlotCanvas"></canvas>' +
                        '</div>');

    // Creates the color1 colorPicker
    var colorPickerColor1 = getColorPicker("colorPickerColor1_" + this.id, this.plotConfig.colorScale.color1, function (color, id) {
      currentObj.plotConfig.colorScale.color1 = color;
      currentObj.onColorScaleChanged();
    });
    colorPickerColor1.addClass("colorPicker1");
    this.colorScale.append(colorPickerColor1);

    // Creates the color2 colorPicker
    var colorPickerColor2 = getColorPicker("colorPickerColor2_" + this.id, this.plotConfig.colorScale.color2, function (color, id) {
      currentObj.plotConfig.colorScale.color2 = color;
      currentObj.onColorScaleChanged();
    });
    colorPickerColor2.addClass("colorPicker2");
    this.colorScale.append(colorPickerColor2);

    // Creates the X0 selector
    this.x0Selector = new BinSelector(this.id + "_x0Selector",
                                      "x0:",
                                      0.0, 1.0, 0.01, this.plotConfig.colorScale.x0,
                                      this.onX0SelectorValuesChanged,
                                      function( event, ui ) {
                                        currentObj.x0Selector.setValues( ui.values[ 0 ], "slider");
                                        currentObj.onX0SelectorValuesChanged();
                                      });
    this.x0Selector.inputChanged = function ( event ) {
       currentObj.x0Selector.setValues( getInputFloatValue(currentObj.x0Selector.fromInput, currentObj.x0Selector.value) );
       currentObj.onX0SelectorValuesChanged();
    };
    this.colorScale.append(this.x0Selector.$html);

    // Creates the Y0 selector
    this.y0Selector = new BinSelector(this.id + "_y0Selector",
                                      "y0:",
                                      0.0, 1.0, 0.01, this.plotConfig.colorScale.y0,
                                      this.onY0SelectorValuesChanged,
                                      function( event, ui ) {
                                        currentObj.y0Selector.setValues( ui.values[ 0 ], "slider");
                                        currentObj.onY0SelectorValuesChanged();
                                      });
    this.y0Selector.inputChanged = function ( event ) {
       currentObj.y0Selector.setValues( getInputFloatValue(currentObj.y0Selector.fromInput, currentObj.y0Selector.value) );
       currentObj.onY0SelectorValuesChanged();
    };
    this.colorScale.append(this.y0Selector.$html);

    // Creates the M selector
    this.mSelector = new BinSelector(this.id + "_mSelector",
                                      "m:",
                                      0.0, 1.0, 0.01, this.plotConfig.colorScale.m,
                                      this.onMSelectorValuesChanged,
                                      function( event, ui ) {
                                        currentObj.mSelector.setValues( ui.values[ 0 ], "slider");
                                        currentObj.onMSelectorValuesChanged();
                                      });
    this.mSelector.inputChanged = function ( event ) {
       currentObj.mSelector.setValues( getInputFloatValue(currentObj.mSelector.fromInput, currentObj.mSelector.value) );
       currentObj.onMSelectorValuesChanged();
    };
    this.colorScale.append(this.mSelector.$html);

    $jqElem.append(this.colorScale);
    this.drawColorScale();
    this.drawColorScalePlot();

    return $jqElem;
  }

  this.onX0SelectorValuesChanged = function () {
    currentObj.plotConfig.colorScale.x0 = currentObj.x0Selector.value;
    currentObj.onColorScaleChanged();
  }

  this.onY0SelectorValuesChanged = function () {
    currentObj.plotConfig.colorScale.y0 = currentObj.y0Selector.value;
    currentObj.onColorScaleChanged();
  }

  this.onMSelectorValuesChanged = function () {
    currentObj.plotConfig.colorScale.m = currentObj.mSelector.value;
    currentObj.onColorScaleChanged();
  }

  this.onColorScaleChanged = function () {
    this.drawColorScale();
    this.drawColorScalePlot();
    this.redrawDiffered();
  }

  this.drawColorScale = function () {
    var canvas = this.colorScale.find(".colorScaleCanvas")[0];
    var context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    var colorscale = getColorScale (this.plotConfig.colorScale);
    var lineWidth = canvas.width / colorscale.length;

    for (i in colorscale) {
      context.beginPath();
      context.moveTo(lineWidth * i + lineWidth/2, 0);
      context.lineTo(lineWidth * i + lineWidth/2, canvas.height);
      context.lineWidth = lineWidth;
      context.strokeStyle = colorscale[i][1];
      context.stroke();
    }
  }

  this.drawColorScalePlot = function () {
    var canvas = this.colorScale.find(".colorPlotCanvas")[0];
    var context = canvas.getContext('2d');
    context.fillStyle="white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    var colorscale = getColorScale (this.plotConfig.colorScale);
    var lineWidth = canvas.width / colorscale.length;
    var x0 = this.plotConfig.colorScale.x0;
    var y0 = this.plotConfig.colorScale.y0;
    var m = Math.pow(this.plotConfig.colorScale.m * 4, 3);
    var prevC = canvas.height - Math.max(Math.min(Math.floor(canvas.height * ((-y0)*m + x0)), canvas.height), 0);
    for (i in colorscale) {
      context.beginPath();
      var x = i / colorscale.length;
      var c = canvas.height - Math.max(Math.min(Math.floor(canvas.height * ((x - y0)*m + x0)), canvas.height), 0);
      context.moveTo(lineWidth * i, prevC);
      context.lineTo(lineWidth * i + lineWidth, c);
      prevC = c;
      context.lineWidth = 1;
      context.stroke();
    }
  }

  this.addPlotConfigStyleJQElem = function ($style) {

    //Adds color style and color scale to style JQElem
    this.appendColorScaleToJqElem($style);

    return $style;
  }
  //END COPIED

  log ("new PhPlot id: " + this.id);

  return this;
}
