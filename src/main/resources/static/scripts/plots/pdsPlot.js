//Power density spectrum and cross spectrum plots

function PDSPlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig) {

  var currentObj = this;

  PlotWithSettings.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable);

  //PDS Stingray parameters:
  this.plotConfig.duration = 0;
  this.plotConfig.nsegm = 1;
  this.plotConfig.segment_size = 0;
  this.plotConfig.type = "Avg";
  this.plotConfig.norm = "leahy";
  this.plotConfig.xAxisType = "linear";
  this.plotConfig.yAxisType = "log";
  this.plotConfig.plotType = "X*Y";
  this.plotConfig.df = 0;
  this.plotConfig.maxSupportedFreq = 0.6 / Math.pow(10, -CONFIG.MAX_TIME_RESOLUTION_DECIMALS);
  this.plotConfig.freqMax = this.plotConfig.maxSupportedFreq;
  this.plotConfig.freqMin = 0.0;

  if (!isNull(projectConfig)) {
    // Prepare PDS Plot attributes from projectConfig
    this.plotConfig.duration = projectConfig.totalDuration;
    this.plotConfig.maxSegmentSize = projectConfig.maxSegmentSize;
    this.plotConfig.segment_size = projectConfig.avgSegmentSize;
  }

  //If plot is pds adds Fits button to plot
  if (!isNull(plotConfig.styles.showFitBtn) && plotConfig.styles.showFitBtn){
    this.btnFit = $('<button class="btn btn-default btnFit" data-toggle="tooltip" title="Fit plot"><i class="fa fa-line-chart" aria-hidden="true"></i></button>');
    this.$html.find(".plotTools").append(this.btnFit);
    this.btnFit.click(function(event){
      onFitPlotClicked(currentObj);
    });
  }

  //PDS plot methods:
  this.addSettingsControls = function(){

    if (this.settingsPanel.find(".pdsNorm").length == 0) {

      if (isNull(this.plotConfig.styles.showPdsType) || this.plotConfig.styles.showPdsType){
        // Creates PDS type radio buttons
        this.typeRadios = getRadioControl(this.id,
                                          'PDS Type',
                                          "pdsType",
                                          [
                                            { id:"Sng", label:"Single", value:"Sng"},
                                            { id:"Avg", label:"Averaged", value:"Avg"}
                                          ],
                                          this.plotConfig.type,
                                          function(value, id) {
                                            currentObj.plotConfig.type = value;
                                            setVisibility(currentObj.segmSelector.$html, value != "Sng");
                                          });
        this.settingsPanel.find(".leftCol").append(this.typeRadios);
      }

      // Creates the Segment length selector
      var tab = getTabForSelector(this.id);
      var segmConfig = this.getSegmSelectorConfig();
      this.segmSelector = new BinSelector(this.id + "_segmSelector",
                                        "Segment Length (" + tab.projectConfig.timeUnit  + "):",
                                        segmConfig.minValue, segmConfig.maxValue, segmConfig.step, segmConfig.initValue,
                                        this.onSegmSelectorValuesChanged,
                                        function( event, ui ) {
                                          currentObj.segmSelector.setValues( ui.values[ 0 ], "slider");
                                          currentObj.onSegmSelectorValuesChanged();
                                        }, null, "log");
      this.segmSelector.setTitle("Segment Length (" + tab.projectConfig.timeUnit + "): <span style='font-size: 0.75em'>Nº Segments= " + fixedPrecision(this.plotConfig.nsegm, 2) + "</span>");
      this.segmSelector.inputChanged = function ( event ) {
         currentObj.segmSelector.setValues( getInputFloatValue(currentObj.segmSelector.fromInput, currentObj.plotConfig.segment_size) );
         currentObj.onSegmSelectorValuesChanged();
      };
      this.settingsPanel.find(".leftCol").append(this.segmSelector.$html);
      if (this.plotConfig.type == "Sng"){
        this.segmSelector.$html.hide();
      }

      // Creates the Normalization radio buttons
      this.normRadios = getRadioControl(this.id,
                                        'Normalization',
                                        "pdsNorm",
                                        [
                                          { id:"leahy", label:"Leahy", value:"leahy"},
                                          { id:"frac", label:"Frac", value:"frac"},
                                          { id:"abs", label:"Abs", value:"abs"},
                                          { id:"none", label:"None", value:"none"}
                                        ],
                                        this.plotConfig.norm,
                                        function(value, id) {
                                          currentObj.plotConfig.norm = value;
                                        });
      this.settingsPanel.find(".leftCol").append(this.normRadios);

      // Creates the Plot Binnin Size selector
      this.rebinSelector = new BinSelector(this.id + "_rebinSelector",
                                          "Frequency Binning (Hz):",
                                          this.plotConfig.freqMin,
                                          this.plotConfig.freqMax,
                                          getStepSizeFromRange(this.plotConfig.freqMax - this.plotConfig.freqMin, 100),
                                          (this.plotConfig.df > 0) ? this.plotConfig.df : this.plotConfig.freqMin,
                                          this.onBinSelectorValuesChanged,
                                          function( event, ui ) {
                                            currentObj.rebinSelector.setValues( ui.values[ 0 ], "slider");
                                            currentObj.onBinSelectorValuesChanged();
                                          }, null, "log");
      this.rebinSelector.setDisableable(true);
      this.rebinSelector.setEnabled(this.plotConfig.df > 0);
      this.rebinSelector.switchBox.click( function ( event ) {
        currentObj.rebinSelector.setEnabled(!currentObj.rebinSelector.enabled);
        if (!currentObj.rebinSelector.enabled) { currentObj.plotConfig.df = 0; }
      });
      this.rebinSelector.inputChanged = function ( event ) {
         currentObj.rebinSelector.setValues( getInputFloatValue(currentObj.rebinSelector.fromInput, currentObj.rebinSelector.value) );
         currentObj.onBinSelectorValuesChanged();
      };
      this.settingsPanel.find(".leftCol").append(this.rebinSelector.$html);

      this.addAxesTypeControlsToSettings(".rightCol");

      // Creates the plot type radio buttons
      this.plotTypeRadios = getRadioControl(this.id,
                                        this.plotConfig.styles.labels[!isNull(this.plotConfig.zAxisType) ? 2 : 1] + ' axis data',
                                        "pdsPlotType",
                                        [
                                          { id:"TypeXY", label:"Power x Frequency", value:"X*Y"},
                                          { id:"TypeX", label:"Power", value:"X"}
                                        ],
                                        this.plotConfig.plotType,
                                        function(value, id) {
                                          currentObj.plotConfig.plotType = value;
                                        });
      this.settingsPanel.find(".rightCol").append(this.plotTypeRadios);

      this.onSettingsCreated();
    }
  }

  this.addFrequencyRangeSelector = function (title, axis, columnClass) {
    if (!isNull(this.plotConfig.freq_range)){
      // Creates the frequency selector
      this.updateMaxMinFreq();
      this.freqSelector = new sliderSelector(this.id + "_freqSelector", title, axis,
                                        this.plotConfig.freqMin, this.plotConfig.freqMax,
                                        this.onFreqRangeValuesChanged,
                                        null,
                                        function( event, ui ) {
                                          currentObj.freqSelector.setValues( ui.values[ 0 ], ui.values[ 1 ], "slider" );
                                          currentObj.onFreqRangeValuesChanged();
                                        },
                                        null,
                                        getStepSizeFromRange(this.plotConfig.freqMax - this.plotConfig.freqMin, 100));
      this.freqSelector.setDisableable(false);
      this.freqSelector.inputChanged = function ( event ) {
         currentObj.setValues( getInputFloatValue(currentObj.freqSelector.fromInput, currentObj.freqSelector.fromValue),
                               getInputFloatValue(currentObj.freqSelector.toInput, currentObj.freqSelector.toValue) );
         currentObj.onFreqRangeValuesChanged();
      };
      if (this.plotConfig.freq_range[0] > -1) {
        this.freqSelector.setValues( currentObj.plotConfig.freq_range[0], currentObj.plotConfig.freq_range[1] );
      }
      this.settingsPanel.find(columnClass).prepend(this.freqSelector.$html);
    } else {
      logErr("addFrequencyRangeSelector -> plotConfig.freq_range is NULL, PDSPlot id: " + this.id)
    }
  }

  this.getSegmSelectorConfig = function () {
    var binSize = this.getBinSize();
    var segmSize = this.plotConfig.segment_size;
    var minValue = binSize * CONFIG.MIN_SEGMENT_MULTIPLIER;
    var maxValue = (this.plotConfig.maxSegmentSize > 0) ? this.plotConfig.maxSegmentSize : segmSize * 100;
    if (this.plotConfig.duration > 0) {
      maxValue = Math.min(maxValue, this.plotConfig.duration);
    }

    return { initValue: segmSize,
             minValue: minValue,
             maxValue: maxValue,
             step: binSize
           }
  }

  this.updateSettings = function(){
    if (this.settingsPanel.find(".pdsNorm").length > 0) {

      if (!isNull(this.segmSelector)){
        if ((this.segmSelector.step != this.plotConfig.binSize)
            || (this.segmSelector.initToValue != this.plotConfig.maxSegmentSize)) {

          this.clearSettings();
        } else {

          this.updateSegmSelector();
          this.segmSelector.setValues(this.plotConfig.segment_size);
        }
      }

    }
  }

  this.onSegmSelectorValuesChanged = function(){
    if (currentObj.plotConfig.duration > 0) {
      currentObj.plotConfig.segment_size = currentObj.segmSelector.value;
      currentObj.updateNSegm();
    }
    currentObj.updateSegmSelector();
  }

  this.updateNSegm = function() {
     this.plotConfig.nsegm =  this.plotConfig.duration / this.plotConfig.segment_size;
  }

  this.updateSegmSelector = function () {
    var tab = getTabForSelector(currentObj.id);
    currentObj.segmSelector.setTitle("Segment Length (" + tab.projectConfig.timeUnit  + "): <span style='font-size: 0.75em'>Nº Segments= " + fixedPrecision(currentObj.plotConfig.nsegm, 2) + "</span>");

    if (Math.floor(currentObj.plotConfig.nsegm) <= 1){
      //If NSegm = 1, set normalization to leahy
      currentObj.normRadios.find("input").prop('checked', false).checkboxradio('refresh');
      currentObj.normRadios.find("input").filter('[value=leahy]').prop('checked', true).checkboxradio('refresh');
    }
  }

  this.onBinSizeChanged = function () {
    //Updates dt
    currentObj.plotConfig.dt = currentObj.binSelector.value;

    //Updates Segment Size selector
    var segmConfig = currentObj.getSegmSelectorConfig();
    currentObj.segmSelector.setMinMaxValues(segmConfig.minValue, segmConfig.maxValue, segmConfig.step);
    currentObj.updateSegmSelector();

    //Updates Rebin selector and Frequency range selector
    currentObj.updateMaxMinFreq(true);
    if (!isNull(currentObj.rebinSelector)) {
      currentObj.rebinSelector.setMinMaxValues (currentObj.plotConfig.freqMin,
                                                currentObj.plotConfig.freqMax,
                                                getStepSizeFromRange(currentObj.plotConfig.freqMax - currentObj.plotConfig.freqMin, 100), false);
    }
    if (!isNull(currentObj.freqSelector)) {
      currentObj.freqSelector.setMinMaxValues (currentObj.plotConfig.freqMin,
                                               currentObj.plotConfig.freqMax);
    }
  }

  this.onBinSelectorValuesChanged = function(){
    if (currentObj.plotConfig.duration > 0) {
      currentObj.plotConfig.df = currentObj.rebinSelector.value;
    }
  }

  this.onFreqRangeValuesChanged = function() {
    currentObj.plotConfig.freq_range = [currentObj.freqSelector.fromValue, currentObj.freqSelector.toValue];
  }

  this.updateMaxMinFreq = function (forceMaxFreq) {
    this.plotConfig.maxSupportedFreq = 0.6 / this.getBinSize();
    this.plotConfig.freqMax = (!isNull(forceMaxFreq) && forceMaxFreq) ? this.plotConfig.maxSupportedFreq : Math.min(this.plotConfig.maxSupportedFreq, this.plotConfig.freqMax);
    this.plotConfig.freqMin = (!isNull(forceMaxFreq) && forceMaxFreq) ? 0.0 : Math.max(0.0, this.plotConfig.freqMin);
  }

  this.updatePlotConfig = function () {
    var binSize = this.getBinSize();
    if (!isNull(binSize)){
      this.plotConfig.dt = binSize;
    } else {
      logErr("ERROR on updatePlotConfig: BinSize is null, Plot: " + this.id);
    }

    var tab = getTabForSelector(this.id);
    if (!isNull(tab)) {
      this.plotConfig.maxSegmentSize = !isNull(this.plotConfig.zAxisType) ? tab.projectConfig.maxSegmentSize / 2 : tab.projectConfig.maxSegmentSize;
      this.plotConfig.segment_size = !isNull(this.segmSelector) ? Math.min(this.segmSelector.value, this.plotConfig.maxSegmentSize) : this.plotConfig.maxSegmentSize / CONFIG.DEFAULT_SEGMENT_DIVIDER;
      this.updateNSegm();
    } else {
      log("UpdatePlotConfig plot data " + this.id + " error: Tab not found for plot id");
    }
  }

  this.prepareData = function (data) {

    if (!isNull(data) && data.length > 2) {

      this.updateMaxMinFreq();

      if (this.plotConfig.plotType == "X*Y") {
        var computeErrors = !isNull(data[1].error_values) && (data[1].values.length == data[1].error_values.length);
        for (i in data[0].values) {
          data[1].values[i] = data[1].values[i] * data[0].values[i];
          if (computeErrors){
            data[1].error_values[i] = data[1].error_values[i] * data[0].values[i];
          }
        }
      }

      this.updateDuration(data[2].values);
      this.updateSettings();

    } else {
      this.showWarn("Wrong data received");
    }

    return data;
  }

  this.updateDuration = function (durationArray) {
    if (durationArray.length > 0
        && durationArray[0] > 0) {
      this.plotConfig.duration = durationArray[0];
      this.updateNSegm();
    }
  }

  this.getLabel = function (axis) {
    if (axis == 1){
      var yLabel = this.plotConfig.styles.labels[1];
      if (this.plotConfig.plotType == "X*Y") {
        if (this.plotConfig.styles.labels[0].startsWith("Freq")
            && this.plotConfig.styles.labels[1].startsWith("Pow")) {
              yLabel = "Power x Frequency (rms/mean)^2";
          } else {
            yLabel += " x " + this.plotConfig.styles.labels[0];
          }
      }
      return yLabel;
    } else {
      return this.plotConfig.styles.labels[axis];
    }
  }

  this.getPlotlyConfig = function (data) {

    var plotlyConfig = get_plotdiv_lightcurve(data[0].values, data[1].values,
                                        [], isNull(data[1].error_values) ? [] : data[1].error_values, [],
                                        this.getLabel(0),
                                        this.getLabel(1),
                                        this.plotConfig.styles.title);

    plotlyConfig = this.addExtraDataConfig(plotlyConfig);
    plotlyConfig = this.prepareAxis(plotlyConfig);

    if (this.plotConfig.plotType == "X*Y") {
      plotlyConfig.layout.yaxis.titlefont = $.extend(true, {}, plotlyConfig.layout.yaxis.titlefont); //Avoid change text size of all plots
      plotlyConfig.layout.yaxis.titlefont.size = 12;
    }

    return plotlyConfig;
  }

  this.setReadyState = function (isReady) {
    this.isReady = isReady;
    if (isReady && (this.data != null)) {
      var warnmsg = this.getWarnMsg();
      if (warnmsg != ""){
          this.showWarn(warnmsg);
      }
    }

    if (!isReady) {
      this.showLoading();
    } else {
      this.hideLoading();
    }
  }

  this.getWarnMsg = function (){
    if (this.data != null) {
      if (!isNull(this.data[3]) && this.data[3].values.length > 0) {
        if (this.data[3].values[0] == "Maximum allowed size exceeded"){
          return "Bin size greater than segment length";
        } else {
          return this.data[3].values[0];
        }
      }
    }
    return "";
  }

  this.updateMaxMinFreq();

  log ("new PDSPlot id: " + this.id);

  return this;
}
