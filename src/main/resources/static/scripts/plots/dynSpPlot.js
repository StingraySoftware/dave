//Dynamical spectrum plots

function DynSpPlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig) {

  var currentObj = this;

  PDSPlot.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig);

  this.plotConfig.yAxisType = "linear";
  this.plotConfig.zAxisType = "log";
  this.plotConfig.plotStyle = "3d";
  this.plotConfig.colorScale = $.extend(true, {}, this.getDefaultPlotlyConfig().DEFAULT_COLORSCALE);
  this.plotConfig.freq_range = [this.plotConfig.freqMin, this.plotConfig.freqMax];

  this.XYLabelAxis = 2;

  this.btnFullScreen.unbind("click").click(function( event ) {
    if (currentObj.isExpanded()) {
      currentObj.btnFullScreen.find("i").switchClass( "fa-compress", "fa-arrows-alt");
    } else {
      currentObj.btnFullScreen.find("i").switchClass( "fa-arrows-alt", "fa-compress");
    }
    currentObj.$html.toggleClass("fullScreen");
    currentObj.resize();
  });

  this.btnLoad.remove();

  //If plot is pds adds Fits button to plot
  this.btnStyle = $('<button class="btn btn-default btnStyle" data-toggle="tooltip" title="Change plot dimensions">2D</button>');
  this.$html.find(".plotTools").prepend(this.btnStyle);
  this.btnStyle.click(function(event){
    if (currentObj.plotConfig.plotStyle == "3d") {
      currentObj.plotConfig.plotStyle = "2d";
      currentObj.btnStyle.html("3D");
    } else {
      currentObj.plotConfig.plotStyle = "3d";
      currentObj.btnStyle.html("2D");
    }
    setVisibility(currentObj.settingsPanel.find(".AxisType"), currentObj.plotConfig.plotStyle == "3d");
    currentObj.refreshData();
  });

  this.isExpanded = function () {
    return this.$html.hasClass("fullScreen");
  }

  this.prepareData = function (data) {

    if (!isNull(data) && data.length == 5) {

      this.updateMaxMinFreq();

      if (currentObj.plotConfig.plotType == "X*Y") {
        for (pds_idx in data[1].values) {
          for (i in data[0].values) {
            data[1].values[pds_idx].values[i] = data[1].values[pds_idx].values[i] * data[0].values[i];
          }
        }
      }

      this.updateDuration(data[3].values);
      this.updateSettings();

    } else {
      this.showWarn("Wrong data received");
    }

    return data;
  }

  this.getPlotlyConfig = function (data) {

    var plotlyConfig = null;
    var plotDefaultConfig = currentObj.getDefaultPlotlyConfig();

    //Creates the plotlyConfig
    if (currentObj.plotConfig.plotStyle == "2d") {

      //ZDATA is an array of arrays with the powers of each time as values
      var z_data=[];
      for (freq_idx in data[0].values) {
        var powers_for_time_data=[];
        for (time_idx in data[2].values) {
          if (!isNull(data[1].values)
              && (data[1].values.length > time_idx)
              && !isNull(data[1].values[time_idx].values)
              && (data[1].values[time_idx].values.length > freq_idx)){
                powers_for_time_data.push(data[1].values[time_idx].values[freq_idx]);
              }
        }
        z_data.push(powers_for_time_data);
      }

      plotlyConfig = get_plotdiv_dynamical_spectrum(data[2].values,
                                                      data[0].values,
                                                      z_data,
                                                      this.getLabel(1),
                                                      this.getLabel(0),
                                                      this.getLabel(2),
                                                      getColorScale (this.plotConfig.colorScale),
                                                      currentObj.plotConfig.styles.title,
                                                      plotDefaultConfig);
      plotlyConfig.data[0].type = "heatmap";

    } else {

      //ZDATA is a flattened array with the powers
      var z_data=[];
      for (pds_idx in data[1].values) {
        z_data.push(data[1].values[pds_idx].values);
      }

      plotlyConfig = get_plotdiv_dynamical_spectrum(data[0].values,
                                                      data[2].values,
                                                      z_data,
                                                      this.getLabel(0),
                                                      this.getLabel(1),
                                                      this.getLabel(2),
                                                      getColorScale (this.plotConfig.colorScale),
                                                      currentObj.plotConfig.styles.title,
                                                      plotDefaultConfig);

      //Set axis type for 3D plot only, log axes not supported on heatmaps
      if (currentObj.plotConfig.xAxisType == "log") {
        plotlyConfig.layout.scene.xaxis.type = 'log';
        plotlyConfig.layout.scene.xaxis.autorange = true;
      }

      if (currentObj.plotConfig.yAxisType == "log") {
        plotlyConfig.layout.scene.yaxis.type = 'log';
        plotlyConfig.layout.scene.yaxis.autorange = true;
      }

      if (currentObj.plotConfig.zAxisType == "log") {
        plotlyConfig.layout.scene.zaxis.type = 'log';
        plotlyConfig.layout.scene.zaxis.autorange = true;
      }

      currentObj.setHoverEventsEnabled(true);

    }

    return plotlyConfig;
  }

  this.onSettingsCreated = function () {

    // Hides axis types if is 2d plot
    if (this.plotConfig.plotStyle == "2d") {
      this.settingsPanel.find(".AxisType").hide();
    }

    //Adds frequency range selector
    this.addFrequencyRangeSelector("Frequency Range (Hz):",
                                    { table:"", column:"", from:this.plotConfig.freqMin, to:this.plotConfig.freqMax },
                                    ".rightCol");
  }

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

  this.registerPlotEvents = function () {
    //Dynamical spectrum plot events disabled
  }

  this.getWarnMsg = function (){
    if (this.data != null) {
      if (this.data[4].values.length > 0) {
        return this.data[4].values[0];
      }
    }
    return "";
  }

  this.saveAsCSV = function () {
    var data = currentObj.data;
    if (!isNull(data)){
      var csvContent = "data:text/csv;charset=utf-8,";
      for (time_idx in data[2].values) {
        for (frec_idx in data[0].values) {
          var infoArray = [data[2].values[time_idx], data[0].values[frec_idx], data[1].values[time_idx].values[frec_idx]];
          dataString = Array.prototype.join.call(infoArray, ",");
          csvContent += time_idx < data[2].values.length ? dataString + "\n" : dataString;
        }
      }
      saveRawToFile(currentObj.plotConfig.styles.title + ".csv", encodeURI(csvContent));
    }
  }

  this.addPlotConfigStyleJQElem = function ($style) {

    //Adds color style and color scale to style JQElem
    this.appendColorScaleToJqElem($style);

    return $style;
  }

  this.getLabel = function (axis) {
    //LaTeX not supported on 3D Plots -> https://github.com/plotly/plotly.js/issues/608
    if (axis == this.XYLabelAxis){

      var yLabel = this.plotConfig.styles.labels[this.XYLabelAxis];

      if (this.plotConfig.plotType == "X*Y" &&
          (isNull(this.plotConfig.styles.XYLabelIsCustom)
              || !this.plotConfig.styles.XYLabelIsCustom)) {
        if (this.plotConfig.styles.labels[0].startsWith("Freq")
            && this.plotConfig.styles.labels[this.XYLabelAxis].startsWith("Pow")) {
              if (this.plotConfig.norm == "leahy") {
                yLabel = "Power (Leahy) x Freq";
              } else if (this.plotConfig.norm == "frac") {
                yLabel = "(rms/mean)^2";
              } else if (this.plotConfig.norm == "abs") {
                yLabel = "rms^2";
              } else if (this.plotConfig.norm == "none") {
                yLabel = "Variance (unnormalized powers) x Freq";
              }
          } else {
            yLabel += " x " + this.plotConfig.styles.labels[0];
          }

      } else if (this.plotConfig.norm == "leahy") {
        yLabel = "Power (Leahy)";
      } else if (this.plotConfig.norm == "frac") {
        yLabel = "(rms/mean)^2 x Freq^-1";
      } else if (this.plotConfig.norm == "abs") {
        yLabel = "rms^2 x Freq^-1";
      } else if (this.plotConfig.norm == "none") {
        yLabel = "Variance (unnormalized powers)";
      }

      return yLabel;
    } else {
      return this.plotConfig.styles.labels[axis];
    }
  }

  log ("new DynSpPlot id: " + this.id);

  return this;
}
