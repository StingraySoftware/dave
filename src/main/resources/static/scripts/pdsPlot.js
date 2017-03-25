
function PDSPlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable) {

  var currentObj = this;

  Plot.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable);

  //PDS Stingray parameters:
  this.plotConfig.duration = 0;
  this.plotConfig.nsegm = 1;
  this.plotConfig.segment_size = 0;
  this.plotConfig.norm = "leahy";
  this.plotConfig.xAxisType = "linear";
  this.plotConfig.yAxisType = "log";
  this.plotConfig.plotType = "X*Y";
  this.plotConfig.rebinSize = 0;
  this.plotConfig.minRebinSize = 0;
  this.plotConfig.maxRebinSize = 0;

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
        this.plotConfig.styles.title + ' Settings:';
      }

      this.setSettingsTitle(title);

      var tab = getTabForSelector(this.id);
      var binSize = tab.projectConfig.binSize;
      if (this.settingsPanel.find(".sliderSelector").length == 0) {

        // Creates the Segment length selector
        var maxValue = binSize * 100;
        if (this.plotConfig.duration > 0) {
          maxValue = this.plotConfig.duration;
        }

        this.segmSelector = new BinSelector(this.id + "_segmSelector",
                                          "Segment Length (" + tab.projectConfig.timeUnit  + "):",
                                          "From",
                                          binSize, maxValue, binSize, binSize,
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
           currentObj.segmSelector.setValues( currentObj.segmSelector.fromInput.val() );
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
           currentObj.binSelector.setValues( currentObj.binSelector.fromInput.val() );
           currentObj.onBinSelectorValuesChanged();
        };
        this.settingsPanel.find(".leftCol").append(this.binSelector.$html);


        // Creates the X axis type radio buttons
        this.xAxisRadios = $('<div class="pdsXAxisType">' +
                              '<h3>X axis type</h3>' +
                              '<fieldset>' +
                                '<label for="' + this.id + '_Xlinear">Linear</label>' +
                                '<input type="radio" name="' + this.id + 'XAxisType" id="' + this.id + '_Xlinear" value="linear" checked="checked">' +
                                '<label for="' + this.id + '_Xlog">Logarithmic</label>' +
                                '<input type="radio" name="' + this.id + 'XAxisType" id="' + this.id + '_Xlog" value="log">' +
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
        this.yAxisRadios = $('<div class="pdsYAxisType">' +
                              '<h3>Y axis type</h3>' +
                              '<fieldset>' +
                                '<label for="' + this.id + '_Ylinear">Linear</label>' +
                                '<input type="radio" name="' + this.id + 'YAxisType" id="' + this.id + '_Ylinear" value="linear">' +
                                '<label for="' + this.id + '_Ylog">Logarithmic</label>' +
                                '<input type="radio" name="' + this.id + 'YAxisType" id="' + this.id + '_Ylog" value="log" checked="checked">' +
                              '</fieldset>' +
                            '</div>');

        this.settingsPanel.find(".rightCol").append(this.yAxisRadios);
        var $yAxisRadios = this.yAxisRadios.find("input[type=radio][name=" + this.id + "YAxisType]")
        $yAxisRadios.checkboxradio();
        this.yAxisRadios.find("fieldset").controlgroup();
        $yAxisRadios.change(function() {
          currentObj.plotConfig.yAxisType = this.value;
        });


        // Creates the plot type radio buttons
        this.plotTypeRadios = $('<div class="pdsPlotType">' +
                              '<h3>Y axis data</h3>' +
                              '<fieldset>' +
                                '<label for="' + this.id + '_TypeXY">Power X Frecuency</label>' +
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

      }
    }
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

  this.prepareData = function (data) {

    if (data != null) {
      if (this.plotConfig.rebinSize != 0) {
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
    }

    return data;
  }

  this.getPlotConfig = function (data) {

    var yLabel = currentObj.plotConfig.styles.labels[1];
    if (currentObj.plotConfig.plotType == "X*Y") {
      yLabel += " X " + currentObj.plotConfig.styles.labels[0];
    }

    var plotConfig = get_plotdiv_lightcurve(data[0].values, data[1].values,
                                        [], [], [],
                                        currentObj.plotConfig.styles.labels[0],
                                        yLabel,
                                        currentObj.plotConfig.styles.title);

    if (currentObj.plotConfig.xAxisType == "log") {
      plotConfig.layout.xaxis.type = 'log';
      plotConfig.layout.xaxis.autorange = true;
    }

    if (currentObj.plotConfig.yAxisType == "log") {
      plotConfig.layout.yaxis.type = 'log';
      plotConfig.layout.yaxis.autorange = true;
    }

    return plotConfig;
  }

  this.setReadyState = function (isReady) {
    this.isReady = isReady;
    if (isReady && (this.data != null)) {
      this.$html.find(".plotTools").find(".btnWarn").remove();
      var warnmsg = this.getWarnMsg();
      if (warnmsg != ""){
          this.btnWarn = $('<button class="btn btn-danger btnWarn ' + this.id + '"><i class="fa fa-exclamation-triangle" aria-hidden="true"></i> ' + warnmsg + '</button>');
          this.$html.find(".plotTools").prepend(this.btnWarn);
      }
    }
  }

  this.getWarnMsg = function (){
    if (this.data != null) {
      if (this.data[3].values.length > 0) {
        return this.data[3].values[0];
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
