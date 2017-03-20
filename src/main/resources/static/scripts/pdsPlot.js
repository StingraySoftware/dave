
function PDSPlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable) {

  var currentObj = this;

  Plot.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable);

  //PDS Stingray parameters:
  this.plotConfig.nsegm = 1;
  this.plotConfig.segment_size = 0;
  this.plotConfig.norm = "leahy";

  //PDS plot attributes:
  this.settingsVisible = false;

  this.settingsPanel = $('<div class="settings"><h3>Settings:</h3></div>');
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

  this.setTitle = function (title) {
    this.settingsPanel.find("h3").first().html(title);
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
      this.setTitle(this.plotConfig.styles.title + ' Settings:');

      var tab = getTabForSelector(this.id);
      var binSize = tab.projectConfig.binSize;
      if (this.settingsPanel.find(".sliderSelector").length == 0) {

        // Creates the Segment length selector
        var maxValue = binSize * 100;
        var duration = this.getDuration();
        if (duration > 0) {
          maxValue = duration;
        }

        this.segmSelector = new BinSelector(this.id + "_segmSelector",
                                          "Segment Length (" + tab.projectConfig.timeUnit  + "):",
                                          "From",
                                          binSize, maxValue, binSize, binSize,
                                          this.onSelectorValuesChanged);

        this.segmSelector.slider.slider({
               min: this.segmSelector.fromValue,
               max: this.segmSelector.toValue,
               values: [this.segmSelector.value],
               step: this.segmSelector.step,
               slide: function( event, ui ) {
                 currentObj.segmSelector.setValues( ui.values[ 0 ], "slider");
                 currentObj.onSelectorValuesChanged();
               }
           });
        this.segmSelector.inputChanged = function ( event ) {
           currentObj.segmSelector.setValues( currentObj.segmSelector.fromInput.val() );
           currentObj.onSelectorValuesChanged();
        };
        this.settingsPanel.append(this.segmSelector.$html);


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

        this.settingsPanel.append(this.normRadios);
        var $radios = this.normRadios.find("input[type=radio][name=" + this.id + "norm]")
        $radios.checkboxradio();
        this.normRadios.find("fieldset").controlgroup();
        $radios.change(function() {
          currentObj.plotConfig.norm = this.value;
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

  this.onSelectorValuesChanged = function(){
    var duration = currentObj.getDuration();
    if (duration > 0) {
      currentObj.plotConfig.segment_size = currentObj.segmSelector.value;
      currentObj.plotConfig.nsegm = parseFloat(Math.round((duration / currentObj.segmSelector.value) * 1000) / 1000).toFixed(3);
      var tab = getTabForSelector(currentObj.id);
      currentObj.segmSelector.setTitle("Segment Length (" + tab.projectConfig.timeUnit  + "):  Nº Segments: " + currentObj.plotConfig.nsegm);

      if (Math.floor(currentObj.plotConfig.nsegm) <= 1){
        //If NSegm = 1, set normalization to leahy
        currentObj.normRadios.find("input").prop('checked', false).checkboxradio('refresh');
        currentObj.normRadios.find("input").filter('[value=leahy]').prop('checked', true).checkboxradio('refresh');
      }
    }
  }

  this.getPlotConfig = function (data) {
    var plotConfig = get_plotdiv_lightcurve(data[0].values, data[1].values,
                                        [], [], currentObj.detectWtiRangesFromData(data),
                                        currentObj.plotConfig.styles.labels[0],
                                        currentObj.plotConfig.styles.labels[1],
                                        currentObj.plotConfig.styles.title);
    plotConfig.layout.yaxis.type = 'log';
    plotConfig.layout.yaxis.autorange = true;
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

  this.getDuration = function (){
    var duration = 0;
    if (this.data != null) {
      if (this.data[2].values.length > 0) {
        duration = this.data[2].values[0];
      }
    }
    return duration;
  }

  this.getWarnMsg = function (){
    var warnmsg = "";
    if (this.data != null) {
      if (this.data[3].values.length > 0) {
        warnmsg = this.data[3].values[0];
      }
    }
    return warnmsg;
  }

  log ("new PDSPlot id: " + this.id);

  return this;
}
