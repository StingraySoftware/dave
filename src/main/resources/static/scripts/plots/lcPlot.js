//Lightcurve plot

function LcPlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable) {

  var currentObj = this;

  PlotWithSettings.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable);

  //LC plot attributes:
  this.baselineEnabled = false;
  this.baseline_opts = {};
  this.baseline_opts.lam = { default:1000, min:1, max: 100000}; //Baseline Smoothness ranges
  this.baseline_opts.p = { default:0.01, min:0.001, max: 1}; //Baseline Asymmetry ranges
  this.baseline_opts.niter = { default:10, min:1, max: 1000}; //Baseline N iterations ranges

  this.meanfluxEnabled = false;
  this.meanflux_opts = {};
  this.meanflux_opts.lam = { default:1000, min:1, max: 100000}; //Meanflux Smoothness ranges
  this.meanflux_opts.p = { default:0.01, min:0.001, max: 1}; //Meanflux Asymmetry ranges
  this.meanflux_opts.niter = { default:10, min:1, max: 1000}; //Meanflux N iterations ranges

  this.countRateStats = "";

  //LC plot methods:
  this.addSettingsControls = function(){

    if (this.settingsPanel.find(".baseline").length == 0) {

      //Baseline controls set
      var $baseline = getSection ("Draw baseline", "baseline", this.baselineEnabled, function ( enabled ) {
                                    currentObj.baselineEnabled = enabled;
                                    currentObj.onBaselineValuesChanged();
                                  }, "clear");
      var $baselineContainer = getSectionContainer($baseline);
      $baselineContainer.append(getInlineRangeBox ("b_lam_" + this.id, "inputLam",
                                                    "Smoothness", this.baseline_opts.lam.default, this.baseline_opts.lam.min, this.baseline_opts.lam.max,
                                                    function(value, input) { currentObj.onBaselineValuesChanged(); }));
      $baselineContainer.append(getInlineRangeBox ("b_p_" + this.id, "inputP",
                                                    "Asymmetry", this.baseline_opts.p.default, this.baseline_opts.p.min, this.baseline_opts.p.max,
                                                    function(value, input) { currentObj.onBaselineValuesChanged(); }));
      $baselineContainer.append(getInlineRangeBox ("b_niter_" + this.id, "inputNiter",
                                                    "Nº iterations", this.baseline_opts.niter.default, this.baseline_opts.niter.min, this.baseline_opts.niter.max,
                                                    function(value, input) { currentObj.onBaselineValuesChanged(); }));

      this.settingsPanel.find(".leftCol").append($baseline);


      //Meanflux controls set
      var $meanflux = getSection ("Draw mean flux", "meanflux", this.meanfluxEnabled, function ( enabled ) {
                                      currentObj.meanfluxEnabled = enabled;
                                      currentObj.onMeanFluxValuesChanged();
                                  }, "clear");
      var $meanfluxContainer = getSectionContainer($meanflux);
      $meanfluxContainer.append(getInlineRangeBox ("mf_lam_" + this.id, "inputLam",
                                                    "Smoothness", this.meanflux_opts.lam.default, this.meanflux_opts.lam.min, this.meanflux_opts.lam.max,
                                                    function(value, input) { currentObj.onMeanFluxValuesChanged(); }));
      $meanfluxContainer.append(getInlineRangeBox ("mf_p_" + this.id, "inputP",
                                                    "Asymmetry", this.meanflux_opts.p.default, this.meanflux_opts.p.min, this.meanflux_opts.p.max,
                                                    function(value, input) { currentObj.onMeanFluxValuesChanged(); }));
      $meanfluxContainer.append(getInlineRangeBox ("mf_niter_" + this.id, "inputNiter",
                                                    "Nº iterations", this.meanflux_opts.niter.default, this.meanflux_opts.niter.min, this.meanflux_opts.niter.max,
                                                    function(value, input) { currentObj.onMeanFluxValuesChanged(); }));

      this.settingsPanel.find(".leftCol").append($meanflux);


      var $referenceLink = $('<a target="_blank" href="https://zanran_storage.s3.amazonaws.com/www.science.uva.nl/ContentPages/443199618.pdf" class="clear InfoText">Algorithm: Eilers, Paul H. C. and Boelens, Hans F.M. Baseline Correction with Asymmetric Least Squares Smoothing. 2005 [Last query: 18/10/2017] <i class="fa fa-external-link" aria-hidden="true"></i></a>');
      this.settingsPanel.find(".leftCol").append($referenceLink);


      //Send setting created event
      this.onSettingsCreated();
    }
  }

  this.onBaselineValuesChanged = function(){
    if (currentObj.baselineEnabled) {
      var baselineContainer = getSectionContainer(currentObj.settingsPanel.find(".baseline"));
      currentObj.plotConfig.baseline_opts.lam = parseInt(baselineContainer.find(".inputLam").val());
      currentObj.plotConfig.baseline_opts.p = parseFloat(baselineContainer.find(".inputP").val());
      currentObj.plotConfig.baseline_opts.niter = parseInt(baselineContainer.find(".inputNiter").val());
    } else {
      currentObj.plotConfig.baseline_opts = { niter: 0 };
    }
  }

  this.onMeanFluxValuesChanged = function(){
    if (currentObj.meanfluxEnabled) {
      var meanfluxContainer = getSectionContainer(currentObj.settingsPanel.find(".meanflux"));
      currentObj.plotConfig.meanflux_opts.lam = parseInt(meanfluxContainer.find(".inputLam").val());
      currentObj.plotConfig.meanflux_opts.p = parseFloat(meanfluxContainer.find(".inputP").val());
      currentObj.plotConfig.meanflux_opts.niter = parseInt(meanfluxContainer.find(".inputNiter").val());
    } else {
      currentObj.plotConfig.meanflux_opts = { niter: 0 };
    }
  }

  this.updateBaselineControls = function () {
    var switchBox = currentObj.settingsPanel.find("#baseline_switch_" + currentObj.id);
    if (currentObj.baselineEnabled) {
      switchBox.switchClass("fa-plus-square", "fa-minus-square");
      currentObj.settingsPanel.find(".baselineContainer").fadeIn();
    } else {
      switchBox.switchClass("fa-minus-square", "fa-plus-square");
      currentObj.settingsPanel.find(".baselineContainer").fadeOut();
    }
  }

  this.updateMeanFluxControls = function () {
    var switchBox = currentObj.settingsPanel.find("#meanflux_switch_" + currentObj.id);
    if (currentObj.meanfluxEnabled) {
      switchBox.switchClass("fa-plus-square", "fa-minus-square");
      currentObj.settingsPanel.find(".meanfluxContainer").fadeIn();
    } else {
      switchBox.switchClass("fa-minus-square", "fa-plus-square");
      currentObj.settingsPanel.find(".meanfluxContainer").fadeOut();
    }
  }

  this.setBaselineEnabled = function (enabled) {
    currentObj.baselineEnabled = enabled;
    currentObj.onBaselineValuesChanged();
    currentObj.updateBaselineControls();
  }

  this.setMeanFluxEnabled = function (enabled) {
    currentObj.meanfluxEnabled = enabled;
    currentObj.onMeanFluxValuesChanged();
    currentObj.updateMeanFluxControls();
  }

  this.getPlotlyConfig = function (data) {

    var coords = this.getSwitchedCoords( { x: 0, y: 1} );
    var plotDefaultConfig = currentObj.getDefaultPlotlyConfig();

    var dataWithGaps = this.addGapsToData(data[0].values, data[1].values, data[2].values, this.plotConfig.dt * 5);

    var plotlyConfig = get_plotdiv_lightcurve(dataWithGaps[0], dataWithGaps[1],
                                        [], dataWithGaps[2],
                                        (data.length > 4) ? this.getWtiRangesFromGtis(data[3].values, data[4].values, data[0].values) : [],
                                        this.plotConfig.styles.labels[coords.x],
                                        this.plotConfig.styles.labels[coords.y],
                                        this.getTitle(),
                                        plotDefaultConfig);

    this.countRateStats = this.getCountRateStats();
    this.setLegendText("");

    if (data.length > 5) {
      if (data[5].values.length > 0) {
        //Lightcurve has baseline values
        plotlyConfig.data.push(getLine (data[0].values, data[5].values, plotDefaultConfig.BASELINE_COLOR, plotDefaultConfig.DEFAULT_LINE_WIDTH.default));
      }
    } else {
      this.btnSettings.hide();
    }

    if (data.length > 6) {
      if (data[6].values.length > 0) {
        //Lightcurve has meanflux values
        plotlyConfig.data.push(getLine (data[0].values, data[6].values, plotDefaultConfig.MEANFLUX_COLOR, plotDefaultConfig.DEFAULT_LINE_WIDTH.default));
      }
    } else {
      this.btnSettings.hide();
    }

    if ((data.length > 22) && (data[22].values.length > 0) && (data[22].values[0] != "")){
        this.showWarn(data[22].values[0]);
    }

    plotlyConfig = this.addExtraDataConfig(plotlyConfig, plotDefaultConfig);
    plotlyConfig = this.prepareAxis(plotlyConfig);

    return plotlyConfig;
  }

  this.addExtraDataConfig = function (plotlyConfig, plotDefaultConfig) {
    if (!isNull(this.extraData) && this.extraData.length > 1){

      //Inserts extra data as line in plot
      var extraTrace = getLine (this.extraData[0], this.extraData[1],
                                plotDefaultConfig.EXTRA_DATA_COLOR, plotDefaultConfig.DEFAULT_LINE_WIDTH.default);
      if (this.extraData.length > 2
          && this.extraData[2].length > 0
          && jQuery.isNumeric(this.extraData[2][0])) {
            //If third extra data column is numeric set is as y_error
            extraTrace.error_y = getErrorConfig(this.extraData[2], plotDefaultConfig);
      }
      extraTrace.comesFromExtra = true;
      plotlyConfig.data.splice(0, 0, extraTrace);

      if (!isNull(this.plotStyle)){
        var extraTraceStyle = this.plotStyle.data.filter(function(trace) { return !isNull(trace.comesFromExtra) && trace.comesFromExtra; });
        if (isNull(extraTraceStyle) || extraTraceStyle.length == 0) {
          this.plotStyle.data.splice(0, 0, getTracePlotStyle(extraTrace));
          this.sendPlotEvent('on_plot_styles_changed', {});
        }
      }
    }
    return plotlyConfig;
  }

  this.updateMinMaxCoords = function (){
    if (this.data != null) {
      var coords = this.getSwitchedCoords( { x: 0, y: 1} );
      var minMaxX = minMax2DArray(this.data[coords.x].values);
      var minMaxY = minMax2DArray(this.data[coords.y].values);
      this.minX = minMaxX.min;
      this.minY = minMaxY.min;
      this.maxX = minMaxX.max;
      this.maxY = minMaxY.max;

      if (!isNull(this.extraData)
          && this.extraData.length > 1) {
          var extraMinMaxX = minMax2DArray(this.extraData[coords.x]);
          var extraMinMaxY = minMax2DArray(this.extraData[coords.y]);
          this.minX = Math.min(minMaxX.min, extraMinMaxX.min);
          this.minY = Math.min(minMaxY.min, extraMinMaxY.min);
          this.maxX = Math.max(minMaxX.max, extraMinMaxX.max);
          this.maxY = Math.max(minMaxY.max, extraMinMaxY.max);
      }

      var tab = getTabForSelector(this.id);
      if (!isNull(tab) && (0 <= this.minY) && (this.minY < this.maxY)){
        tab.updateMinMaxCountRate(this.minY, this.maxY);
      }
    }
  }

  this.getPlotDefaultTracesCount = function (){
    return (currentObj.data.length > 5 && currentObj.data[5].values.length > 0) ? 2 : 1;
  }

  this.mustPropagateAxisFilter = function (axis) {
    return (axis == 1) || this.plotConfig.styles.labels[axis].startsWith(this.plotConfig.axis[axis].column);
  }

  this.getAxisForPropagation = function (axis) {
    if (axis == 1) {
      var propagationAxis =  $.extend({}, this.plotConfig.axis[axis]);
      propagationAxis.column = "RATE";
      return propagationAxis;
    } else {
      return this.plotConfig.axis[axis];
    }
  }

  this.addGapsToData = function (times, values, errorValues, minGapTime) {
    if (!isNull(times)
        && !isNull(values)
        && times.length > 1
        && times.length == values.length){

      var gapDelay = currentObj.plotConfig.dt * 0.5;
      for (i = 1; i < times.length; i++) {

        var prevTime = times[i - 1];
        var nextTime = times[i];

        if ((nextTime - prevTime) > minGapTime) {
          times.splice(i, 0, prevTime + gapDelay);
          values.splice(i, 0, null);
          errorValues.splice(i, 0, null);
          times.splice(i + 1, 0, nextTime - gapDelay);
          values.splice(i + 1, 0, null);
          errorValues.splice(i + 1, 0, null);
        }
      }

    } else {
      log("ERROR on addGapsToData for LcPlot id: " + this.id)
    }

    return [times, values, errorValues];
  }

  this.setLegendText = function (text) {
    if (text != ""){
      this.$hoverinfo.html(text);
    } else {
      this.$hoverinfo.html(this.countRateStats);
    }
  }

  this.getCountRateStats = function () {
    var countRateStats = "";

    if (this.data != null) {
      var coords = this.getSwitchedCoords( { x: 0, y: 1} );
      var countrateArr = this.data[coords.y].values;
      countRateStats = this.plotConfig.styles.labels[coords.y] + " -> ";
      var minMaxY = minMax2DArray(countrateArr);
      var sum = 0;
      var validCount = 0;
      var elem = null;
      for(var i=0; i<countrateArr.length; i++){
        elem = countrateArr[i];
        if (!isNull(elem) && !isNaN(elem)){
          sum+=elem;
          validCount++;
        }
      }

      countRateStats += " avg: " + (sum/validCount).toFixed(2);
      countRateStats += ", min: " + minMaxY.min.toFixed(2);
      countRateStats += ", max: " + minMaxY.max.toFixed(2);
      countRateStats += ", count: " + validCount;
    }

    return countRateStats;
  }

  //Disable BaseLine and Variance parameters:
  this.setBaselineEnabled(false);
  this.setMeanFluxEnabled(false);

  log ("new LcPlot id: " + this.id);

  return this;
}
