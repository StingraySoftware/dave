//Power density spectrum and cross spectrum plots

function PDSPlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig) {

  var currentObj = this;

  Plot.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable);

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
    this.plotConfig.segment_size = projectConfig.avgSegmentSize;
    this.plotConfig.minRebinSize = projectConfig.minBinSize;
    this.plotConfig.maxRebinSize = projectConfig.totalDuration;
  }

  //PDS plot attributes:
  this.settingsVisible = false;

  this.settingsPanel = $('<div class="settings">' +
                            '<div class="row title"><h3>Settings:</h3></div>' +
                            '<div class="row">' +
                              '<div class="col-xs-6 leftCol">' +
                              '</div>' +
                              '<div class="col-xs-6 rightCol">' +
                              '</div>' +
                            '</div>' +
                          '</div>');
  this.settingsPanel.hide();
  this.$html.prepend(this.settingsPanel);

  this.btnSettings = $('<button class="btn btn-default btnSettings' + this.id + '"><i class="fa fa-cog" aria-hidden="true"></i></button>');
  this.$html.find(".plotTools").append(this.btnSettings);
  this.btnSettings.click(function(event){
    currentObj.showSettings();
  });

  this.btnBack = $('<button class="btn btn-default btnBack' + this.id + '"><i class="fa fa-arrow-left" aria-hidden="true"></i></button>');
  this.btnBack.hide();
  this.$html.find(".plotTools").append(this.btnBack);
  this.btnBack.click(function(event){
    currentObj.hideSettings();
  });

  //If plot is pds adds Fits button to plot
  if (!isNull(plotConfig.styles.showFitBtn) && plotConfig.styles.showFitBtn){
    this.btnFit = $('<button class="btn btn-default btnFit"><i class="fa fa-line-chart" aria-hidden="true"></i></button>');
    this.$html.find(".plotTools").append(this.btnFit);
    this.btnFit.click(function(event){
      onFitPlotClicked(currentObj);
    });
  }

  //PDS plot methods:

  this.setSettingsTitle = function (title) {
    this.settingsPanel.find(".title").find("h3").first().html(title);
  }

  this.showSettings = function(){
    if (!this.settingsVisible) {
      this.settingsVisible = true;
      var height = parseInt(this.$html.find(".plot").height());
      this.$html.find(".plot").hide();
      this.$html.find(".plotTools").children().hide();
      this.btnBack.show();
      this.settingsPanel.show();
      this.settingsPanel.css({ 'height': height + 'px' });

      var title = 'Settings:';
      if (!isNull(this.plotConfig.styles.title)){
        title = this.plotConfig.styles.title + ' Settings:';
      }

      this.setSettingsTitle(title);

      if (this.settingsPanel.find(".sliderSelector").length == 0) {

        if (isNull(plotConfig.styles.showPdsType) || plotConfig.styles.showPdsType){
          // Creates PDS type radio buttons
          this.typeRadios = $('<div class="pdsType">' +
                                '<h3>Type</h3>' +
                                '<fieldset>' +
                                  '<label for="' + this.id + '_Sng">Single</label>' +
                                  '<input type="radio" name="' + this.id + '_Type" id="' + this.id + '_Sng" value="Sng">' +
                                  '<label for="' + this.id + '_Avg">Averaged</label>' +
                                  '<input type="radio" name="' + this.id + '_Type" id="' + this.id + '_Avg" value="Avg" checked="checked">' +
                                '</fieldset>' +
                              '</div>');

          this.settingsPanel.find(".leftCol").append(this.typeRadios);
          var $typeRadios = this.typeRadios.find("input[type=radio][name=" + this.id + "_Type]")
          $typeRadios.checkboxradio();
          this.typeRadios.find("fieldset").controlgroup();
          $typeRadios.change(function() {
            currentObj.plotConfig.type = this.value;
          });
        }

        // Creates the Segment length selector
        var tab = getTabForSelector(this.id);
        var binSize = tab.projectConfig.binSize;
        var segmSize = !isNull(plotConfig.segment_size) ? plotConfig.segment_size : Math.max(binSize, tab.projectConfig.avgSegmentSize);
        var maxValue = segmSize * 100;
        if (this.plotConfig.duration > 0) {
          maxValue = this.plotConfig.duration;
        }

        this.segmSelector = new BinSelector(this.id + "_segmSelector",
                                          "Segment Length (" + tab.projectConfig.timeUnit  + "):",
                                          "From",
                                          binSize, maxValue, binSize, segmSize,
                                          this.onSegmSelectorValuesChanged);
        this.segmSelector.setTitle("Segment Length (" + tab.projectConfig.timeUnit  + "):  Nº Segments: " + this.plotConfig.nsegm);
        this.segmSelector.slider.slider({
               min: this.segmSelector.fromValue,
               max: this.segmSelector.toValue,
               values: [this.segmSelector.value],
               step: this.segmSelector.step,
               slide: function( event, ui ) {
                 currentObj.segmSelector.setValues( ui.values[ 0 ], "slider");
                 currentObj.onSegmSelectorValuesChanged();
               }
           });
        this.segmSelector.inputChanged = function ( event ) {
           currentObj.segmSelector.setValues( getInputFloatValue(currentObj.segmSelector.fromInput, plotConfig.segment_size) );
           currentObj.onSegmSelectorValuesChanged();
        };
        this.settingsPanel.find(".leftCol").append(this.segmSelector.$html);


        // Creates the Normalization radio buttons
        this.normRadios = $('<div class="pdsNorm">' +
                              '<h3>Normalization</h3>' +
                              '<fieldset>' +
                                '<label for="' + this.id + '_leahy">Leahy</label>' +
                                '<input type="radio" name="' + this.id + 'norm" id="' + this.id + '_leahy" value="leahy" checked="checked">' +
                                '<label for="' + this.id + '_frac">Frac</label>' +
                                '<input type="radio" name="' + this.id + 'norm" id="' + this.id + '_frac" value="frac">' +
                                '<label for="' + this.id + '_abs">Abs</label>' +
                                '<input type="radio" name="' + this.id + 'norm" id="' + this.id + '_abs" value="abs">' +
                                '<label for="' + this.id + '_none">None</label>' +
                                '<input type="radio" name="' + this.id + 'norm" id="' + this.id + '_none" value="none">' +
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
        this.binSelector = new BinSelector(this.id + "_binSelector",
                                          "Binning (Freq):",
                                          "From",
                                          this.plotConfig.minRebinSize, this.plotConfig.maxRebinSize, this.plotConfig.minRebinSize, this.plotConfig.minRebinSize,
                                          this.onBinSelectorValuesChanged);
        this.binSelector.setDisableable(true);
        this.binSelector.setEnabled(currentObj.plotConfig.rebinEnabled);
        this.binSelector.switchBox.click( function ( event ) {
          currentObj.plotConfig.rebinEnabled = !currentObj.plotConfig.rebinEnabled;
          currentObj.binSelector.setEnabled(currentObj.plotConfig.rebinEnabled);
        });
        this.binSelector.slider.slider({
               min: this.binSelector.fromValue,
               max: this.binSelector.toValue,
               values: [this.binSelector.value],
               step: this.binSelector.step,
               slide: function( event, ui ) {
                 currentObj.binSelector.setValues( ui.values[ 0 ], "slider");
                 currentObj.onBinSelectorValuesChanged();
               }
           });
        this.binSelector.inputChanged = function ( event ) {
           currentObj.binSelector.setValues( getInputFloatValue(currentObj.binSelector.fromInput, currentObj.binSelector.value) );
           currentObj.onBinSelectorValuesChanged();
        };
        this.settingsPanel.find(".leftCol").append(this.binSelector.$html);


        // Creates the X axis type radio buttons
        var XlinearChecked = (this.plotConfig.xAxisType == "linear") ? 'checked="checked"' : "";
        var XlogChecked = (this.plotConfig.xAxisType == "log") ? 'checked="checked"' : "";
        this.xAxisRadios = $('<div class="pdsXAxisType AxisType">' +
                              '<h3>' + currentObj.plotConfig.styles.labels[0] + ' axis type</h3>' +
                              '<fieldset>' +
                                '<label for="' + this.id + '_Xlinear">Linear</label>' +
                                '<input type="radio" name="' + this.id + 'XAxisType" id="' + this.id + '_Xlinear" value="linear" ' + XlinearChecked + '>' +
                                '<label for="' + this.id + '_Xlog">Logarithmic</label>' +
                                '<input type="radio" name="' + this.id + 'XAxisType" id="' + this.id + '_Xlog" value="log" ' + XlogChecked + '>' +
                              '</fieldset>' +
                            '</div>');

        this.settingsPanel.find(".rightCol").append(this.xAxisRadios);
        var $xAxisRadios = this.xAxisRadios.find("input[type=radio][name=" + this.id + "XAxisType]")
        $xAxisRadios.checkboxradio();
        this.xAxisRadios.find("fieldset").controlgroup();
        $xAxisRadios.change(function() {
          currentObj.plotConfig.xAxisType = this.value;
        });


        // Creates the Y axis type radio buttons
        var YlinearChecked = (this.plotConfig.yAxisType == "linear") ? 'checked="checked"' : "";
        var YlogChecked = (this.plotConfig.yAxisType == "log") ? 'checked="checked"' : "";
        this.yAxisRadios = $('<div class="pdsYAxisType AxisType">' +
                              '<h3>' + currentObj.plotConfig.styles.labels[1] + ' axis type</h3>' +
                              '<fieldset>' +
                                '<label for="' + this.id + '_Ylinear">Linear</label>' +
                                '<input type="radio" name="' + this.id + 'YAxisType" id="' + this.id + '_Ylinear" value="linear" ' + YlinearChecked + '>' +
                                '<label for="' + this.id + '_Ylog">Logarithmic</label>' +
                                '<input type="radio" name="' + this.id + 'YAxisType" id="' + this.id + '_Ylog" value="log" ' + YlogChecked + '>' +
                              '</fieldset>' +
                            '</div>');

        this.settingsPanel.find(".rightCol").append(this.yAxisRadios);
        var $yAxisRadios = this.yAxisRadios.find("input[type=radio][name=" + this.id + "YAxisType]")
        $yAxisRadios.checkboxradio();
        this.yAxisRadios.find("fieldset").controlgroup();
        $yAxisRadios.change(function() {
          currentObj.plotConfig.yAxisType = this.value;
        });

        if (!isNull(this.plotConfig.zAxisType)) {
          // Creates the X axis type radio buttons
          var ZlinearChecked = (this.plotConfig.zAxisType == "linear") ? 'checked="checked"' : "";
          var ZlogChecked = (this.plotConfig.zAxisType == "log") ? 'checked="checked"' : "";
          this.zAxisRadios = $('<div class="pdsZAxisType AxisType">' +
                                '<h3>' + currentObj.plotConfig.styles.labels[2] + ' axis type</h3>' +
                                '<fieldset>' +
                                  '<label for="' + this.id + '_Zlinear">Linear</label>' +
                                  '<input type="radio" name="' + this.id + 'ZAxisType" id="' + this.id + '_Zlinear" value="linear" ' + ZlinearChecked + '>' +
                                  '<label for="' + this.id + '_Zlog">Logarithmic</label>' +
                                  '<input type="radio" name="' + this.id + 'ZAxisType" id="' + this.id + '_Zlog" value="log" ' + ZlogChecked + '>' +
                                '</fieldset>' +
                              '</div>');

          this.settingsPanel.find(".rightCol").append(this.zAxisRadios);
          var $zAxisRadios = this.zAxisRadios.find("input[type=radio][name=" + this.id + "ZAxisType]")
          $zAxisRadios.checkboxradio();
          this.zAxisRadios.find("fieldset").controlgroup();
          $zAxisRadios.change(function() {
            currentObj.plotConfig.zAxisType = this.value;
          });
        }

        // Creates the plot type radio buttons
        this.plotTypeRadios = $('<div class="pdsPlotType">' +
                              '<h3>' + currentObj.plotConfig.styles.labels[!isNull(this.plotConfig.zAxisType) ? 2 : 1] + ' axis data</h3>' +
                              '<fieldset>' +
                                '<label for="' + this.id + '_TypeXY">Power x Frequency</label>' +
                                '<input type="radio" name="' + this.id + 'PlotType" id="' + this.id + '_TypeXY" value="X*Y" checked="checked">' +
                                '<label for="' + this.id + '_TypeX">Power</label>' +
                                '<input type="radio" name="' + this.id + 'PlotType" id="' + this.id + '_TypeX" value="X">' +
                              '</fieldset>' +
                            '</div>');

        this.settingsPanel.find(".rightCol").append(this.plotTypeRadios);
        var $plotTypeRadios = this.plotTypeRadios.find("input[type=radio][name=" + this.id + "PlotType]")
        $plotTypeRadios.checkboxradio();
        this.plotTypeRadios.find("fieldset").controlgroup();
        $plotTypeRadios.change(function() {
          currentObj.plotConfig.plotType = this.value;
        });

        this.settingCreated();
      }
    }
  }

  this.settingCreated = function(){
    //Just for notify inherited plots that setting panel was created, must be overriden.
  }

  this.hideSettings = function(){
    if (this.settingsVisible) {
      this.settingsVisible = false;
      this.settingsPanel.hide();
      this.$html.find(".plot").show();
      this.$html.find(".plotTools").children().show();
      this.btnBack.hide();
      this.refreshData();
    }
  }

  this.onSegmSelectorValuesChanged = function(){
    if (currentObj.plotConfig.duration > 0) {
      currentObj.plotConfig.segment_size = currentObj.segmSelector.value;
      currentObj.plotConfig.nsegm = parseFloat(Math.round((currentObj.plotConfig.duration / currentObj.segmSelector.value) * 1000) / 1000).toFixed(2);
    }
    currentObj.updateSegmSelector();
  }

  this.updateSegmSelector = function () {
    var tab = getTabForSelector(currentObj.id);
    currentObj.segmSelector.setTitle("Segment Length (" + tab.projectConfig.timeUnit  + "):  Nº Segments: " + currentObj.plotConfig.nsegm);

    if (Math.floor(currentObj.plotConfig.nsegm) <= 1){
      //If NSegm = 1, set normalization to leahy
      currentObj.normRadios.find("input").prop('checked', false).checkboxradio('refresh');
      currentObj.normRadios.find("input").filter('[value=leahy]').prop('checked', true).checkboxradio('refresh');
    }
  }

  this.onBinSelectorValuesChanged = function(){
    if (currentObj.plotConfig.duration > 0) {
      currentObj.plotConfig.rebinSize = currentObj.binSelector.value;
    }
  }

  this.updatePlotConfig = function () {
    var tab = getTabForSelector(this.id);
    var plotConfig = this.plotConfig;
    plotConfig.dt = tab.projectConfig.binSize;
    if (!isNull(this.segmSelector)){
      plotConfig.segment_size = (tab.projectConfig.maxSegmentSize != 0) ? Math.min(tab.projectConfig.maxSegmentSize, this.segmSelector.value) : currentObj.segmSelector.value;
    } else {
      plotConfig.segment_size = tab.projectConfig.maxSegmentSize;
    }
    plotConfig.nsegm = parseFloat(Math.round((plotConfig.duration / plotConfig.segment_size) * 1000) / 1000).toFixed(2);

    if (!isNull(this.segmSelector)){
      this.updateSegmSelector();
      this.segmSelector.setValues(plotConfig.segment_size);
    }
  }

  this.prepareData = function (data) {

    if (!isNull(data) && data.length > 2) {
      if (this.plotConfig.rebinEnabled && this.plotConfig.rebinSize != 0) {
        try {
          var rebinnedData = this.rebinData(data[0].values, data[1].values, this.plotConfig.rebinSize, "sum");
          data[0].values = rebinnedData.x;
          data[1].values = rebinnedData.y;
        } catch (ex) {
          log("Rebin plot data " + this.id + " error: " + ex);
        }
      } else if (data[0].values.length > 1) {
          this.plotConfig.minRebinSize = data[0].values[1] - data[0].values[0];
          this.plotConfig.maxRebinSize = (data[0].values[data[0].values.length - 1] - data[0].values[0]) / 4;
      }

      if (currentObj.plotConfig.plotType == "X*Y") {
        for (i in data[0].values) {
          data[1].values[i] = data[1].values[i] * data[0].values[i];
        }
      }

      if (data[2].values.length > 0
          && data[2].values[0] > 0) {
        this.plotConfig.duration = data[2].values[0];
      }
    } else {
      this.showWarn("Wrong data received");
    }

    return data;
  }

  this.getLabel = function (axis) {
    if (axis == 1){
      var yLabel = currentObj.plotConfig.styles.labels[1];
      if (currentObj.plotConfig.plotType == "X*Y") {
        if (currentObj.plotConfig.styles.labels[0].startsWith("Freq")
            && currentObj.plotConfig.styles.labels[1].startsWith("Pow")) {
              yLabel = "Power x Frequency (rms/mean)^2";
          } else {
            yLabel += " x " + currentObj.plotConfig.styles.labels[0];
          }
      }
      return yLabel;
    } else {
      return this.plotConfig.styles.labels[axis];
    }
  }

  this.getPlotlyConfig = function (data) {

    var plotlyConfig = get_plotdiv_lightcurve(data[0].values, data[1].values,
                                        [], [], [],
                                        this.getLabel(0),
                                        this.getLabel(1),
                                        currentObj.plotConfig.styles.title);

    plotlyConfig = currentObj.prepareAxis(plotlyConfig);

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
