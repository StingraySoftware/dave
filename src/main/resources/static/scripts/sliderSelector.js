
var sliderSelectors_array = [];

function sliderSelector(id, title, filterData, fromLabel, toLabel, fromValue, toValue, onSelectorValuesChangedFn) {

  var currentObj = this;
  this.id = id;
  this.title = title;
  this.filterData = filterData;
  this.fromLabel = fromLabel;
  this.toLabel = toLabel;
  this.initFromValue = fromValue;
  this.initToValue = toValue;
  this.fromValue = fromValue;
  this.toValue = toValue;
  this.onSelectorValuesChanged = onSelectorValuesChangedFn;
  this.enabled = false;

  sliderSelectors_array[this.id] = this;

  this.$html = $('<div class="sliderSelector ' + this.id + '">' +
                  '<h3>' + title +
                  '<div class="switch-wrapper">' +
                  '  <input id="switch_' + this.id + '" type="checkbox">' +
                  '</div>' +
                  '</h3>' +
                  '<div class="selectorContainer">' +
                  ' <input id="from_' + this.id + '" class="selectorFrom" type="text" name="from_' + this.id + '" placeholder="' + fromLabel + '" value="' + fromValue + '" />' +
                  ' <input id="to_' + this.id + '" class="selectorTo" type="text" name="to_' + this.id + '" placeholder="' + toLabel + '" value="' + toValue + '" />' +
                  ' <div id="slider-' + this.id + '" class="selectorSlider"></div>' +
                  '</div>' +
                '</div>');

  //Caches the controls for further use
  this.container = this.$html.find(".selectorContainer");
  this.switchBox = this.$html.find("#switch_" + this.id);
  this.fromInput = this.$html.find("#from_" + this.id);
  this.toInput = this.$html.find("#to_" + this.id);
  this.slider = this.$html.find("#slider-" + this.id);

  //Prepares switchBox
  this.switchBox.click( function ( event ) {
    var switchId = event.target.id.replace("switch_", "");
    sliderSelectors_array[switchId].setEnabled (this.checked);
    sliderSelectors_array[switchId].onSelectorValuesChanged();
  });

  //Creates the slider
  this.slider.slider({
         range:true,
         min: this.fromValue,
         max: this.toValue,
         values: [ fromValue, toValue ],
         slide: function( event, ui ) {
           var sliderId = event.target.id.replace("slider-", "");
           sliderSelectors_array[sliderId].setValues( ui.values[ 0 ], ui.values[ 1 ], "slider");
           sliderSelectors_array[sliderId].onSelectorValuesChanged();
         }
     });

   //Set values method
   this.setValues = function (from, to, source) {
     this.fromValue = from;
     this.toValue = to;
     this.fromInput.val( this.fromValue );
     this.toInput.val( this.toValue );
     if (source != "slider") {
       this.slider.slider('values', 0, this.fromValue);
       this.slider.slider('values', 1, this.toValue);
     }
   }

   this.getFilter = function () {
     if (this.enabled) {
        this.filterData.from = this.fromValue;
        this.filterData.to = this.toValue;
        return this.filterData;
     } else {
        return null;
     }
   }

   this.applyFilter = function (filter) {
     if (this.filterData.table == filter.table
          && this.filterData.column == filter.column
          && (this.fromValue < filter.from
          || this.toValue > filter.to )) {

        this.setValues( filter.from, filter.to );
        this.setEnabled (true);
        this.onSelectorValuesChanged();
     }
   }

   this.setEnabled = function (enabled) {
     this.enabled = enabled;
     this.switchBox.prop("checked", enabled);
     if (enabled) {
       this.container.fadeIn();
     } else {
       this.setValues( this.initFromValue, this.initToValue );
       this.container.fadeOut();
     }
   }

   //Collapses container
   this.container.hide();

   log ("new sliderSelector id: " + this.id + ", fromValue: " + this.fromValue + ", toValue: " + this.toValue);

   return this;
}


//STATIC SLIDER_SELECTOR METHODS
function sliderSelectors_remove (){
  sliderSelectors_array = [];
  $(".sliderSelector").remove();
}

function sliderSelectors_clear () {
  for (i in sliderSelectors_array) {
    sliderSelectors_array[i].setEnabled (false);
  }
}

function sliderSelectors_getFilters () {
  var filters = [];
  for (i in sliderSelectors_array) {
    var filter = sliderSelectors_array[i].getFilter();
    if (filter != null) {
      filters.push(filter);
    }
  }
  return filters;
}

function sliderSelectors_applyFilters (filters) {
  for (f in filters) {
    for (i in sliderSelectors_array) {
      sliderSelectors_array[i].applyFilter(filters[f]);
    }
  }
}
