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
  this.plotConfig.rebinEnabled = false;
  this.plotConfig.rebinSize = 0;
  this.plotConfig.minRebinSize = 0;
  this.plotConfig.maxRebinSize = 0;

  if (!isNull(projectConfig)) {
    // Prepare PDS Plot attributes from projectConfig
    this.plotConfig.duration = projectConfig.totalDuration;
    this.plotConfig.maxSegmentSize = projectConfig.maxSegmentSize;
    this.plotConfig.segment_size = projectConfig.avgSegmentSize;
    this.plotConfig.minRebinSize = projectConfig.minBinSize;
    this.plotConfig.rebinSize = projectConfig.minBinSize;
    this.plotConfig.maxRebinSize = projectConfig.totalDuration;
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
        this.typeRadios = $('<div class="pdsType">' +
                              '<h3>PDS Type:</h3>' +
                              '<fieldset>' +
                                '<label for="' + this.id + '_Sng">Single</label>' +
                                '<input type="radio" name="' + this.id + '_Type" id="' + this.id + '_Sng" value="Sng" ' + getCheckedState(this.plotConfig.type == "Sng") + '>' +
                                '<label for="' + this.id + '_Avg">Averaged</label>' +
                                '<input type="radio" name="' + this.id + '_Type" id="' + this.id + '_Avg" value="Avg" ' + getCheckedState(this.plotConfig.type == "Avg") + '>' +
                              '</fieldset>' +
                            '</div>');

        this.settingsPanel.find(".leftCol").append(this.typeRadios);
        var $typeRadios = this.typeRadios.find("input[type=radio][name=" + this.id + "_Type]")
        $typeRadios.checkboxradio();
        this.typeRadios.find("fieldset").controlgroup();
        $typeRadios.change(function() {
          currentObj.plotConfig.type = this.value;
          setVisibility(currentObj.segmSelector.$html, currentObj.plotConfig.type != "Sng");
        });
      }

      // Creates the Segment length selector
      var tab = getTabForSelector(this.id);
      var binSize = this.getBinSize();
      var segmSize = this.plotConfig.segment_size;
      var minValue = binSize * CONFIG.MIN_SEGMENT_MULTIPLIER;
      var maxValue = (this.plotConfig.maxSegmentSize > 0) ? this.plotConfig.maxSegmentSize : segmSize * 100;
      if (this.plotConfig.duration > 0) {
        maxValue = Math.min(maxValue, this.plotConfig.duration);
      }

      this.segmSelector = new BinSelector(this.id + "_segmSelector",
                                        "Segment Length (" + tab.projectConfig.timeUnit  + "):",
                                        "From",
                                        minValue, maxValue, binSize, segmSize,
                                        this.onSegmSelectorValuesChanged,
                                        function( event, ui ) {
                                          currentObj.segmSelector.setValues( ui.values[ 0 ], "slider");
                                          currentObj.onSegmSelectorValuesChanged();
                                        });
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
      this.normRadios = $('<div class="pdsNorm">' +
                            '<h3>Normalization:</h3>' +
                            '<fieldset>' +
                              '<label for="' + this.id + '_leahy">Leahy</label>' +
                              '<input type="radio" name="' + this.id + 'norm" id="' + this.id + '_leahy" value="leahy" ' + getCheckedState(this.plotConfig.norm == "leahy") + '>' +
                              '<label for="' + this.id + '_frac">Frac</label>' +
                              '<input type="radio" name="' + this.id + 'norm" id="' + this.id + '_frac" value="frac" ' + getCheckedState(this.plotConfig.norm == "frac") + '>' +
                              '<label for="' + this.id + '_abs">Abs</label>' +
                              '<input type="radio" name="' + this.id + 'norm" id="' + this.id + '_abs" value="abs" ' + getCheckedState(this.plotConfig.norm == "abs") + '>' +
                              '<label for="' + this.id + '_none">None</label>' +
                              '<input type="radio" name="' + this.id + 'norm" id="' + this.id + '_none" value="none" ' + getCheckedState(this.plotConfig.norm == "none") + '>' +
                            '</fieldset>' +
                          '</div>');

      this.settingsPanel.find(".leftCol").append(this.normRadios);
      var $normRadios = this.normRadios.find("input[type=radio][name=" + this.id + "norm]")
      $normRadios.checkboxradio();
      this.normRadios.find("fieldset").controlgroup();
      $normRadios.change(function() {
        currentObj.plotConfig.norm = this.value;
      });


      // Creates the Plot Binnin Size selector
      this.rebinSelector = new BinSelector(this.id + "_rebinSelector",
                                        "Binning (Freq):",
                                        "From",
                                        this.plotConfig.minRebinSize, this.plotConfig.maxRebinSize, this.plotConfig.minRebinSize, this.plotConfig.rebinSize,
                                        this.onBinSelectorValuesChanged,
                                        function( event, ui ) {
                                          currentObj.rebinSelector.setValues( ui.values[ 0 ], "slider");
                                          currentObj.onBinSelectorValuesChanged();
                                        });
      this.rebinSelector.setDisableable(true);
      this.rebinSelector.setEnabled(currentObj.plotConfig.rebinEnabled);
      this.rebinSelector.switchBox.click( function ( event ) {
        currentObj.plotConfig.rebinEnabled = !currentObj.plotConfig.rebinEnabled;
        currentObj.rebinSelector.setEnabled(currentObj.plotConfig.rebinEnabled);
      });
      this.rebinSelector.inputChanged = function ( event ) {
         currentObj.rebinSelector.setValues( getInputFloatValue(currentObj.rebinSelector.fromInput, currentObj.rebinSelector.value) );
         currentObj.onBinSelectorValuesChanged();
      };
      this.settingsPanel.find(".leftCol").append(this.rebinSelector.$html);

      this.addAxesTypeControlsToSettings(".rightCol");

      // Creates the plot type radio buttons
      this.plotTypeRadios = $('<div class="pdsPlotType">' +
                            '<h3>' + currentObj.plotConfig.styles.labels[!isNull(this.plotConfig.zAxisType) ? 2 : 1] + ' axis data:</h3>' +
                            '<fieldset>' +
                              '<label for="' + this.id + '_TypeXY">Power x Frequency</label>' +
                              '<input type="radio" name="' + this.id + 'PlotType" id="' + this.id + '_TypeXY" value="X*Y" ' + getCheckedState(this.plotConfig.plotType == "X*Y") + '>' +
                              '<label for="' + this.id + '_TypeX">Power</label>' +
                              '<input type="radio" name="' + this.id + 'PlotType" id="' + this.id + '_TypeX" value="X" ' + getCheckedState(this.plotConfig.plotType == "X") + '>' +
                            '</fieldset>' +
                          '</div>');

      this.settingsPanel.find(".rightCol").append(this.plotTypeRadios);
      var $plotTypeRadios = this.plotTypeRadios.find("input[type=radio][name=" + this.id + "PlotType]")
      $plotTypeRadios.checkboxradio();
      this.plotTypeRadios.find("fieldset").controlgroup();
      $plotTypeRadios.change(function() {
        currentObj.plotConfig.plotType = this.value;
      });

      this.onSettingsCreated();
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
    currentObj.segmSelector.setStep(this.getBinSize());

    if (Math.floor(currentObj.plotConfig.nsegm) <= 1){
      //If NSegm = 1, set normalization to leahy
      currentObj.normRadios.find("input").prop('checked', false).checkboxradio('refresh');
      currentObj.normRadios.find("input").filter('[value=leahy]').prop('checked', true).checkboxradio('refresh');
    }
  }

  this.onBinSizeChanged = function () {
    currentObj.plotConfig.dt = currentObj.binSelector.value;
    currentObj.updateSegmSelector();
  }

  this.onBinSelectorValuesChanged = function(){
    if (currentObj.plotConfig.duration > 0) {
      currentObj.plotConfig.rebinSize = currentObj.rebinSelector.value;
    }
  }

  this.updatePlotConfig = function () {
    var binSize = this.getBinSize();
    if (!isNull(binSize)){
      this.plotConfig.dt = binSize;
    } else {
      log("ERROR on updatePlotConfig: BinSize is null, Plot: " + this.id);
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
      if (this.plotConfig.rebinEnabled && this.plotConfig.rebinSize != 0) {
        try {
          var rebinnedData = this.rebinData(data[0].values, data[1].values, this.plotConfig.rebinSize, "sum");
          data[0].values = rebinnedData.x;
          data[1].values = rebinnedData.y;
          data[1].error_values = null;
        } catch (ex) {
          log("Rebin plot data " + this.id + " error: " + ex);
        }
      } else if (data[0].values.length > 1) {
          this.plotConfig.minRebinSize = data[0].values[1] - data[0].values[0];
          this.plotConfig.maxRebinSize = (data[0].values[data[0].values.length - 1] - data[0].values[0]) / CONFIG.DEFAULT_SEGMENT_DIVIDER;
      }

      if (this.plotConfig.plotType == "X*Y") {
        var computeErrors = !isNull(data[1].error_values) && (data[1].values.length == data[1].error_values.length);
        for (i in data[0].values) {
          data[1].values[i] = data[1].values[i] * data[0].values[i];
          if (computeErrors){
            data[1].error_values[i] = data[1].error_values[i] * data[0].values[i];
          }
        }
      }

      if (data[2].values.length > 0
          && data[2].values[0] > 0) {
        this.plotConfig.duration = data[2].values[0];
        this.updateNSegm();
      }

      this.updateSettings();

    } else {
      this.showWarn("Wrong data received");
    }

    return data;
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

    plotlyConfig = currentObj.prepareAxis(plotlyConfig);

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
      if (this.data[3].values.length > 0) {
        if (this.data[3].values[0] == "Maximum allowed size exceeded"){
          return "Bin size greater than segment length";
        } else {
          return this.data[3].values[0];
        }
      }
    }
    return "";
  }

  this.rebinData = function (x, y, dx_new, method){

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

  log ("new PDSPlot id: " + this.id);

  return this;
}
