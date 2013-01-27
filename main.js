// # Leonardo Visual Search Example

// global app object
var app;

var INFINITE_SCROLL = true;

// ## router
//
var Router = Backbone.Router.extend({

  routes: {
    ""                          : "interest",
    'stream/:lid'               : 'suggestStream',
    "home"                      : "interest",
    "suggest"                   : "suggest",
    "cart"                      : "cart",
    'search/:keyword'           : 'search',
    'search'                    : 'search',
    'tag/:tag'                  : 'tag',
    'tag/:tag/stream/:lid'      : 'tagStream',
    'artist/:artist'            : 'artist',
    'artist/:artist/stream/:lid': 'artistStream',
    'art/:lid'                  : 'art',
    'similar/:lid'              : 'similar',
    'similar/:lid/stream/:lid2' : 'similarStream',
    'new'                       : "new",
    
  },
  
});

// configure rivets
console.log('configuring rivets...');
rivets.configure({
  adapter: {
    subscribe: function(obj, keypath, callback) {
      callback.wrapped = function(m, v) { callback(v) };
      obj.on('change:' + keypath, callback.wrapped);
    },
    unsubscribe: function(obj, keypath, callback) {
      obj.off('change:' + keypath, callback.wrapped);
    },
    read: function(obj, keypath) {
      return obj.get(keypath);
    },
    publish: function(obj, keypath, value) {
      obj.set(keypath, value);
    }
  }
});
console.log('rivets configured for backbone.js');
  
  
// ## A collection that's shared among many views
//
var SharedCollection = function(collection) {

  this.collection   = collection;
  this.isStale      = true;
  this.deferred     = $.Deferred();
  this.promise      = this.deferred.promise();
  this.idHash       = undefined;
  
  this.expire = function() {
    this.isStale    = true;
    this.deferred   = $.Deferred();
    this.promise    = this.deferred.promise();
  },
  
  this.makeReady = function(options) {   
    var model = this;
    
    if (!this.collection) 
      return false;
         
    if (model.isStale) {
      // collection
      //console.log('making collection ready...');
      // NOTE: reset is not called when passing {add:true} to fetch()
      //model.collection.on('reset', function() {
      //  console.log('collection is reset.');
      //  model.deferred.resolve(model.collection, model);
      //});
      
      // fetch data from server
      //console.log('fetching collection...');
      // if options are NOT passed, then reset the page to 0
      if (!options)
        model.collection.options.page = 0;

      model.collection.fetch(
        _.extend({
          success: function(c, r) {
            
            // compare with existing idHash and mark model's as 'new'
            var isNew = (function() {
              if (!model.idHash) {
                model.idHash = {};
                return true;
              }
              return false;
            })();
            
            console.log('isNew', isNew);
            
            // set state for each model in collection
            c.each(function(item) {                
              
              console.log('marking', item.id, (item.id in model.idHash));
              
              // set flag based on original data
              if (!isNew) 
                item.set({'isNewRecommendation': !(item.id in model.idHash) });
              
              // mark as 'seen'
              model.idHash[item.id] = true;
            });
            
            
            console.log("'seen' key length", _.keys(model.idHash).length);
            console.log('hash', model.idHash);
            
            // resolve the deferred, after those flags have been set
            model.deferred.resolve(model.collection, model);
          }
        }, options));
      
      // mark as NOT stale
      model.isStale = false;
      return true;
    }
  };
  
};


// # view model
//
var SuggestModel = Backbone.Model.extend({
  
  defaults: {
    isInvalid                 : false,
    suggestDeferred        : null,
  }
  
});

var ArtViewModel = Backbone.Model.extend({

  defaults: {
    model: null,
  }
});

var SearchViewModel = Backbone.Model.extend({

  defaults: {
    query             : {},
    sharedPromise     : void 0,
  },
  
  makeCollection: function() {
    
    // get the query
    var query   = this.get('query');
    var action  = this.get('action');
    
    //console.log('query', query);
    
    // create the proper collection for the search criteria
    var collection;
    
    if (query.similar) { // similar artwork    
      //collection = new Leo.Collections.LooksLike(null, { count: 50, lid: query.similar });   
      collection = new Leo.Collections.RecommendationByArtwork(null, { count: 50, lid: query.similar });   
         
    }
    else {  // regular art query
      collection = new Leo.Collections.Art(null, _.extend({count: 50}, query));      
    }
    
    // create the shared collection, fetch it, then set the promise for others
    var shared = new SharedCollection(collection);   
    shared.makeReady(); 
    
    this.set('sharedPromise', shared);
  },
  
  initialize: function() {
    this.on('change:query', this.makeCollection);
  },
    
});

// # controls model
//
var ControlsModel = Backbone.Model.extend({

    defaults: {
      thumbUp       : false,
      thumbDown     : false,
      isControlView : undefined,
    }
});

// ## Site Navigation View
//
var SiteNavView = Backbone.View.extend({
  
  model: new (Backbone.Model.extend({
    defaults: {
      hasNew: undefined,
    }
  })),

  initialize: function() {
    var view = this;
    
    // rivets bind
    rivets.bind(view.$el, {model: view.model});
    
    // for tooltip
    view.$new = view.$el.find('[rel="new"]');
    
    // new recommendations event
    $('body').on('new_recommendations', function(e, hasNew) { 
      
      view.model.set({hasNew: hasNew});
      
      // new recommendations are ready  
      if (hasNew) {        
        // tooltip
        console.log('new', view.$new);
        view.$el.trigger('tooltip', {id: 'new', el: view.$new});
      }
    });
  }  
});

// # controls view
//
var ControlsView = Backbone.View.extend({

  delegate: void 0,
  
  events: {
    // click will trigger an event named in the 'data-event' attribute of the link 
    'click [data-command]': function(e) {
        e.preventDefault();
        var event = $(e.currentTarget).data('command');
        if (this.delegate) this.delegate.$el.trigger(event, e);
    },
    
    'thumbDown' : function(model) {
      console.log('thumbDown', model);
    },
    
  },
  
  'thumbUp' : function(model) {
      console.log('thumbup', this, model);
      
      //$t = $(e.currentTarget).find('span');
      //$t.addClass('sticky');
      
    },
  
  initialize: function() {
    var view = this;
    
    // new model
    view.model = new ControlsModel({thumbUp: false, thumbDown: false});
    
    // rivets bind
    rivets.bind(view.$el, {model: view.model});
    
    // capture subscribe event
    $('body').on('toolbar.subscribe', function(e, data) {  
      
      var subview   = data['view'];
      var callback  = data['callback'];
      view.delegate = subview;
      
      if (callback) {
        
        // new controls model
        view.model.set({'thumbUp'   : false});
        view.model.set({'thumbDown' : false});
        
        // give new model to callback
        callback(view.model);
      }
    });    
    
    // remove all the sticky classes
    $('body').on('toolbar.reset', function(e) {     
      view.$el.find('span.sticky').removeClass('sticky');
    });   
    
  }
});

/*
var Meta = Backbone.Model.extend({
  defaults: {
    title: 'untitled'
  }
});
*/

// ## header link
//
var HeaderLinkView = Backbone.View.extend({
  
  prevTitle: false,
 
  render: function(data) {
    var view = this;
    
    if (data.title == view.prevTitle) {
      var html = Mustache.render(view.$template, data);
      view.$el.html(html);
    }
    else {
      view.prevTitle = data.title;
      view.$el.fadeOut('fast', function() {
        var html = Mustache.render(view.$template, data);
        view.$el.html(html);
        view.$el.fadeIn('slow');
      });
    }   
  },
  
  initialize: function() {
    var view = this;
    
    // get template ID and template text
    var templateID = view.$el.data('template');
    view.$template = $(templateID).text();
      
    // re-render on 'headerlinks' event
    $('body').on('headerlink', function(e, data) {     
      view.render(data);
    }); 
  }
  
});

//----------------------------------------------------------------------
//
// App View
//
//----------------------------------------------------------------------
var AppView = Backbone.View.extend({
  
  router        : new Router(),
  tabs          : {},
  
  // view models
  controls      : new ControlsModel(),
  singleModel   : new ArtViewModel(),
  searchModel   : new SearchViewModel(),
  
  // views
  controlsView  : new ControlsView({el: $('#controls')}),
  siteNavView   : new SiteNavView({el: $('#site-nav')}),
  
  // tooltip flags
  hasShownNewRecomTooltip : false,
  
  // events
  events: {
    
    'delete.tooltips': function() {
      // console.log('deleting all tooltips...');
      $('.tp').grumble('delete');
    },
    
    'tooltip': function(e, options) {
      var view = this;
      
      var data = {
        text        : 'UNKNOWN',
        angle       : 180,
        sel         : undefined,
        el          : undefined,
        distance    : 0,
        id          : undefined,
        hideOnClick : true,
        onClick     : false,
      };
      
      if (_.isObject(options))    
        _.extend(data, options);
      else
        data.id = options; // only an ID was passed
      
      if ('grid' == data.id) {
        data.sel = '#headerlink';
        data.text = 'Click for the art stream';
        data.angle = 225;
        data.distance = 0;
      }
      else if ('stream' == data.id) {
        data.sel = '#headerlink';
        data.text = 'Click for thumbnails';
        data.angle = 225;
        data.distance = 0;
      }
      else if ('new' == data.id) {
        data.text = 'Click to see new art';
        data.angle = 225;
        data.distance = 15;
      }
      else if ('taglist' == data.id) {
        data.text = 'Click icons to like/unlike';
        data.angle = 135;
        data.distance = -50;
      }
      else if (('new-recom' == data.id) && !view.hasShownNewRecomTooltip) {
        data.text = "This one's new";
        data.angle = 170;
        data.distance = -30;
        //view.hasShownNewRecomTooltip = true;
      }
      else {
        // bail
        return;
      }
      
      // get an element
      if (!data.el) {
        data.el = $(data.sel);
      }
      
      if (data.el) {
      
        // fetch cookie
        var cookieName = 'leo-help-' + Leo.options.agent + '-' + data.id;
        var cookie = new jecookie(cookieName);
        if(cookie.load())
          return; // ignore
        
        // tooltip
        data.el.grumble('delete');
        data.el.grumble(
          {
            text        : data.text, 
            angle       : data.angle,
            hideOnClick : data.hideOnClick,
            type        : 'alt-',  
            distance    : data.distance, 
            showAfter   : 1000,
            hideAfter   : false,
            onClick     : data.onClick || function() {              
              // supress next time
              cookie.data = true;
              cookie.save();
            },
          }
        );
      }
    },
    
    //'click [rel="search"]' : function(e) {
    //  var $t = $(e.currentTarget);
    //  console.log('click search update', $t);
    //},
    
    'submit [data-role="search"]' : function(e) {
      e.preventDefault();
      var keyword = $('input[data-role="keyword"]').val();  
      this.router.navigate('search/' + keyword, { trigger: true });
    }
  },
  
  // actions
  // ## post feedback
  //
  postFeedback: function(feedback, cb) {
    var view = this;
    
    // create a taste model
    var taste = new Leo.Models.Taste(feedback);
    
    // save taste model
    taste.save(null, {
      success: function() {
        if (cb)
          cb(null, taste);
      },
      error: function() {
        alert('error saving taste');
        if (cb)
          cb(false, taste);
      }
    });  
    return taste;
  },
  
  initialize: function() {
    var view = this;
    
    // header links (anon)
    new HeaderLinkView({el: $('#headerlink')});
    
    // postfeedback event handler
    view.$el.on('postFeedback', function(e, data) {
      //console.log('postFeedback', e, data);
      var taste = view.postFeedback(data.data, data.callback);
      //console.log('feedback taste', taste);
    });
   
    // status checker
    var status = new Leo.Models.Status();
    status.on('change', function() {
      if (true == this.get('hasUpdate')) {        
        view.$el.trigger('new_recommendations', true);
      }
    });
    setInterval(function() {     
      status.fetch();      
    }, 5000);
  
    // controls events
    this.controls.on('change:isControlView', function(model, val) {      
     
      // feedback controls
      if (val.canFeedback)
        $('[data-rel="feedback"]').show();
      else
        $('[data-rel="feedback"]').hide();
      
      // next control
      if (val.canNext)
        $('[data-rel="stream-next"]').show();
      else
        $('[data-rel="stream-next"]').hide();
        
      if (val.canPlay) 
        $('[data-rel="stream-play"]').show();
      else
        $('[data-rel="stream-play"]').hide();
      
      // prev control
      if (val.canPrev)
        $('[data-rel="stream-prev"]').show();
      else
        $('[data-rel="stream-prev"]').hide();
      
    });
    
    // nav bar controls
    //
    new UserNavbarView({el: this.$el});
    
    // #new
    //
    this.router.on('route:new', function() {
      console.log('route:new');
            
      // make the collection stale
      interestModel.expire();
      
      view.$el.trigger('new_recommendations', false);
      
      // navigate to home
      view.router.navigate('#', {trigger: true, replace: true });
    });
    
    // deferred for interest view and gallery view that share a common collection
    //
    var interestCollection  = new Leo.Collections.Recommendations(null, { page: 0, count: 50 });
    var interestModel       = new SharedCollection(interestCollection);
    
    // handler expire suggest
    view.$el.on('expire_suggest', function() {
      console.log('expire_suggest');
      interestModel.expire();
    });
    
    //console.log('calling view.delegateEvents();', view.$el);
    view.delegateEvents(); // FIXME don't know WHY I need to do this here
    
    // #interest
    //
    var interestView = new SuggestGridView({el: $('#interest')});
    this.router.on('route:interest', function() {
      console.log('route:interest');
      
      // delete all tooltips
      view.$el.trigger('delete.tooltips');
      
      // setup page
      view.controls.set({isControlView: { canFeedback: false, canNext: false, canPlay: true }});      
      
      // temporary header text
      if ('pending' == interestModel.promise.state()) {
        view.$el.trigger('headerlink', { link: '#', title: 'Getting artwork...', ga: 'ga-none'} );    
      }
      
      // update header text when ready
      $.when(interestModel.promise).done(function(collection) { 
        var label = 'Your suggestions';
        var link = '#stream/' + collection.at(0).id;
        view.$el.trigger('headerlink', { link: link, title: label, ga: 'ga-arrow'} );
              
        // tooltip
        view.$el.trigger('tooltip', 'grid');
      });
      
      // request the collection
      interestModel.makeReady();
      
      // show tab and render
      $('#interest-link').tab('show');
      interestView.render(interestModel.promise);
    });
    
    // #gallery
    // ... shares collection with 'interest' view
    var galleryView = new GalleryTabView({el: $('#gallery')});
    
    this.router.on('route:suggestStream', function(lid) {    
      
      // delete all tooltips
      view.$el.trigger('delete.tooltips');
      
      // update view
      view.controls.set({isControlView: { canFeedback: true, canNext: true, canPrev: true, canPlay: true }});
      
      // temporary header text
      if ('pending' == interestModel.promise.state()) {
        view.$el.trigger('headerlink', { link: '#', title: 'Getting artwork...', ga: 'ga-none'} );    
      }
      
      // update header text when ready
      $.when(interestModel.promise).done(function(collection) { 
        var label = 'Your suggestions';
        var link = '#';
        view.$el.trigger('headerlink', { link: link, title: label, ga: 'ga-grid'} );
        
        // tooltip
        view.$el.trigger('tooltip', 'stream');
      });
      
      // request the collection
      interestModel.makeReady();
      
      // render and show tab
      galleryView.render(lid, interestModel.promise);
      $('#gallery-link').tab('show');
      
    })
    
    // this view is re-used for all kinds of searches
    //
    this.tabs.search = new SearchGridView({el: $('#search'), viewModel: this.searchModel});
    
    // render on #search
    this.router.on('route:search', function(keyword) {
      console.log('route:search', keyword);
      view.controls.set({isControlView: { canFeedback: false, canNext: false }});
      $('#search-link').tab('show');         
      var label = 'Search for "' + keyword + '"';
      
      // change events in the model, trigger the render of the view
      // FIXME: to tightly coupled
      view.searchModel.set({label: label, query: {keyword: keyword}});
      
    });
    
    // render on #home
    this.router.on('route:home', function() {
      // view.router.navigate('suggest');
      $('#home-link').tab('show');
      view.controls.set({isControlView: { canFeedback: false, canNext: false }});
      var homeView = new HomeTabView({el: $('#home')});
      homeView.render();
    });
    
    // render on #suggest
    this.tabs.suggest = new SuggestTabView({el: $('#suggest')});
    this.router.on('route:suggest', function() {
      $('#suggest-link').tab('show');         
      view.controls.set({isControlView: { canFeedback: true, canNext: true }});
      //var suggestView = new SuggestTabView({el: $('#suggest')});
      view.tabs.suggest.render();
    });
    
    // render on #cart
    this.router.on('route:cart', function() {
      $('#cart-link').tab('show');      
      view.controls.set({isControlView: { canFeedback: false, canNext: false }});
      var cartView = new CartTabView({el: $('#cart')});
      cartView.render();
    });

    // render on #art/:lid 'single' page
    this.tabs.single = new SingleTabView({el: $('#single'), viewModel: view.singleModel, length: 1 });    
    this.router.on('route:art', function(lid) {
      console.log('route:art', lid); 
     
      //view.$el.trigger('change:meta', {title: 'single art', subnavtitle: false});
      view.controls.set({isControlView: { canFeedback: false, canNext: false }});
      view.tabs.single.render(lid);
      $('#art-link').tab('show');
    });
        
    // render on #tag/:tag
    //     
    this.router.on('route:tag', function(tag) {
      
      // delete all tooltips
      view.$el.trigger('delete.tooltips');
      
      // setup page
      view.controls.set({isControlView: { canFeedback: true, canNext: false }});   
      view.tabs.search.options.path = '#tag/' + tag + '/stream';
      
      // this triggers the creation of the collection
      view.searchModel.set({
        query               : {tag: tag}, 
        action              : { class: '', verb: 'like', tag: tag, href: '#', text: 'Like' },
      });
      
      // temporary header text
      var promise = view.searchModel.get('sharedPromise').promise;
      if ('pending' == promise.state()) {
        view.$el.trigger('headerlink', { link: '#', title: 'Getting tagged artwork...', ga: 'ga-none'} );    
      }
      
      // update header text when ready
      $.when(promise).done(function(collection) {  
        // update the headings based on search criteria
        var label = updateMeta(view, view.searchModel, collection);
        var link = '#tag/' + tag + '/stream/' + collection.at(0).id;              
        view.$el.trigger('headerlink', { link: link, title: label, ga: 'ga-arrow'} );        
      });
      
      // show tab and render
      $('#search-link').tab('show');
      view.tabs.search.render();
    });
    
    // render the #tag/stream
    this.router.on('route:tagStream', function(tag, lid) {       
      console.log('route:tagStream');
      
      // delete all tooltips
      view.$el.trigger('delete.tooltips');
      
      // this triggers the creation of the collection
      view.searchModel.set({
        query               : {tag: tag}, 
        action              : { class: '', verb: 'like', tag: tag, href: '#', text: 'Like' },
      });

      // update view
      view.controls.set({isControlView: { canFeedback: true, canNext: true, canPrev: true }});      

      // temporary header text
      var promise = view.searchModel.get('sharedPromise').promise;
      if ('pending' == promise.state()) {
        view.$el.trigger('headerlink', { link: '#', title: 'Getting tagged artwork...', ga: 'ga-none'} );    
      }
      
      // update header text when ready
      $.when(promise).done(function(collection) {  
        // update the headings based on search criteria
        var label = updateMeta(view, view.searchModel, collection);
        var link = '#tag/' + tag;
        view.$el.trigger('headerlink', { link: link, title: label, ga: 'ga-grid'} );
      });
      
      // create new view if necessary
      var sharedCollection = view.searchModel.get('sharedPromise');
      var gView = new GalleryTabView({el: $('#gallery')});
      
      // render and show tab
      gView.render(lid, sharedCollection.promise);
      $('#gallery-link').tab('show');
    });    

    // render on #artist/:artist
    this.router.on('route:artist', function(artist) {
      
      // delete all tooltips
      view.$el.trigger('delete.tooltips');
      
      // set the new query
      view.searchModel.set({
          query: {artistid: artist}
      });
      
      // update page
      view.tabs.search.options.path = '#artist/' + artist + '/stream';
      view.controls.set({isControlView: { canFeedback: true, canNext: false }});

      // temporary header text
      var promise = view.searchModel.get('sharedPromise').promise;
      if ('pending' == promise.state()) {
        view.$el.trigger('headerlink', { link: '#', title: 'Getting artwork...', ga: 'ga-none'} );    
      }
      
      // update header text when ready
      $.when(promise).done(function(collection) {  
        // update the headings based on search criteria
        var label = updateMeta(view, view.searchModel, collection);
        var link = '#artist/' + artist + '/stream/' + collection.at(0).id;  
        view.$el.trigger('headerlink', { link: link, title: label, ga: 'ga-arrow'} );
      });
      
      // show and render the search tab
      $('#search-link').tab('show'); 
      view.tabs.search.render();
      
    });
    
    // render the #artist/stream/:lid
    this.router.on('route:artistStream', function(artist, lid) {    
      
      // delete all tooltips
      view.$el.trigger('delete.tooltips');
      
      // set the new query
      view.searchModel.set({
          query: {artistid: artist}
      });      
      
      // update view
      view.controls.set({isControlView: { canFeedback: true, canNext: true, canPrev: true }});

      // temporary header text
      var promise = view.searchModel.get('sharedPromise').promise;
      if ('pending' == promise.state()) {
        view.$el.trigger('headerlink', { link: '#', title: 'Getting artwork...', ga: 'ga-none'} );    
      }
      
      // update header text when ready
      $.when(promise).done(function(collection) {  
        // update the headings based on search criteria
        var label = updateMeta(view, view.searchModel, collection);
        var link = '#artist/' + artist;
        view.$el.trigger('headerlink', { link: link, title: label, ga: 'ga-grid'} );
      });
      
      // create new view if necessary
      var sharedCollection = view.searchModel.get('sharedPromise');
      var gView = new GalleryTabView({el: $('#gallery')});
      
      // render and show tab
      gView.render(lid, sharedCollection.promise);      
      $('#gallery-link').tab('show');
    });
    
    // render on #similar/:lid
    this.router.on('route:similar', function(lid) {
      
      // delete all tooltips
      view.$el.trigger('delete.tooltips');
      
      // update search model
      view.searchModel.set({
          query: {similar: lid}
      });
      
      // update view
      view.controls.set({isControlView: { canFeedback: false, canNext: false }});

      // temporary header text
      var promise = view.searchModel.get('sharedPromise').promise;
      if ('pending' == promise.state()) {
        view.$el.trigger('headerlink', { link: '#', title: 'Getting artwork...', ga: 'ga-none'} );    
      }
      
      // update header text when ready
      $.when(promise).done(function(collection) {  
        // update the headings based on search criteria
        var label = updateMeta(view, view.searchModel, collection);
        var link = '#similar/' + lid + '/stream/' + collection.at(0).id;  
        view.$el.trigger('headerlink', { link: link, title: label, ga: 'ga-arrow'} );
      });      
      view.tabs.search.options.path = '#similar/' + lid + '/stream';
      
      // render the search tab
      $('#search-link').tab('show');  
      view.tabs.search.render();
      
    });
    
    // render the #similar/stream/:lid
    this.router.on('route:similarStream', function(lid, lid2) {  
      
      // delete all tooltips
      view.$el.trigger('delete.tooltips');
      
      // update search model
      view.searchModel.set({
          query: {similar: lid}
      });
      
      // temporary header text
      var promise = view.searchModel.get('sharedPromise').promise;
      if ('pending' == promise.state()) {
        view.$el.trigger('headerlink', { link: '#', title: 'Getting artwork...', ga: 'ga-none'} );    
      }
      
      // update header text when ready
      $.when(promise).done(function(collection) {  
        // update the headings based on search criteria
        var label = updateMeta(view, view.searchModel, collection);
        var link = '#similar/' + lid; 
        view.$el.trigger('headerlink', { link: link, title: label, ga: 'ga-grid'} );
      });   
      //view.$el.trigger('change:meta', {title: label, subnavtitle: false});
      view.controls.set({isControlView: { canFeedback: true, canNext: true, canPrev: true }});
      
      // create new view if necessary
      var sharedCollection = view.searchModel.get('sharedPromise');
      var gView = new GalleryTabView({el: $('#gallery')});
      
      // render and show tab
      gView.render(lid2, sharedCollection.promise);      
      $('#gallery-link').tab('show');
    });
    
    // once the routes are created and events are registered
    // start the history...
    console.log('starting history...');
    Backbone.history.start();  

  }
});

var FlaggingView = Backbone.View.extend({
  
  events: {    
    'mouseenter button.tag3' : 'tagMouseEnter',
    'mouseleave button.tag3' : 'tagMouseLeave',    
  },
  
  tagMouseEnter: function(e) {
    var t = $(e.currentTarget);
    if (t.hasClass('active')) {
      t.removeClass('active');
      t.addClass('inactive');
    }
    else {
      t.removeClass('inactive');
      t.addClass('active');
    }
  },
  
  tagMouseLeave: function(e) {
    var t = $(e.currentTarget);
    if (t.hasClass('active')) {
      t.removeClass('active');
      t.addClass('inactive');
    }
    else {
      t.removeClass('inactive');
      t.addClass('active');
    }    
  },
  
});


/**
 * construct a more useful model-view of art items
 */
function preRenderArt(items) {
  
  _.each(items,function(item) {        
  
    // add url base for next links
    item.rel = 'stream';
    
    // flags
    //----------------------------------------------------------------
    item.flags = { artist: { class: false }, similar: { class: false }, tags: false };
    
    // artist & similarity
    item.flags.artist.active = ( false !== item.likeartist );
    item.flags.similar.active = ( false !== item.likeart ); // ? 'active' : 'undef';
    item.flags.popular = ( item.likepop );
    item.flags.random  = ( item.likerandom );
    
    // actions
    if (item.isLiked)
      item.dislike = { verb: 'unlike', lid: item.id, text: 'Unlike', href: '#' };
    else
      item.like = { verb: 'like', lid: item.id, text: 'Like', href: '#' };
      
    // global dislike
    item.forceDislike = { verb: 'dislike', lid: item.id, href: '#' };
    
    // tags
    item.flags.tags = (item.liketags && 0 < item.liketags.length);
   
    
    // remove duplicate tags
    //----------------------------------------------------------------
    
    // create hashmaps of the item.tags
    var liketagmap = {};
    var seentagmap = {};
    _.each(item.liketags, function(tag) { liketagmap[tag.tag] = true; });   
    item.tags = _.filter(item.tags, function(tag) {
      var keep = !(liketagmap[tag.tag] || seentagmap[tag.tag]);
      seentagmap[tag.tag] = true;
      return keep;
    });
    item.liketags = _.filter(item.liketags, function(tag) {
      if (liketagmap[tag.tag]) {
        liketagmap[tag.tag] = false;
        return true;
      }
      else {
        return false;
      }
    });
    
  });

  return items;
}

// ## Events for a Grid of Art thumbnails
//
var GridEvents = {
  
 'click [data-action]' : function(e) {      
    e.preventDefault();
    var view = this;
    
    var $e     = $(e.currentTarget);
    var verb   = $e.data('action');
    var lid    = $e.data('lid');
    var tag    = $e.data('tag');
    var artist = $e.data('artist');
    
    //console.log('verb', verb);
    //console.log('lid', lid);
    //console.log('tag', tag);
    
    var feedback = { };
    if (tag)
      feedback['tag'] = tag;
    if (lid)
      feedback['lid'] = lid;
    if (artist)
      feedback['artist'] = artist;
      
    feedback[verb] = lid ? 'lid' : tag ? 'tag' : artist ? 'artist' : null;
    console.log('feedback', feedback);
    
    // post feedback
    view.$el.trigger('postFeedback', { 
      data    : feedback, 
      callback: function(err, taste) {        
        if (!err) {
          
          // fetch model
          var model = view.collection.get(lid);
          console.log('modifing model', model);
          
          // change state of button
          if ('like' == verb) {
            $e.html($('#ithumb-unlike').html());
            $e.data('action', 'unlike');
            if (model) {
              model.set('isLiked', true);
              model.set('isDisliked', false);
            }
          }
          else if ('unlike' == verb) {
            $e.html($('#ithumb-like').html());
            $e.data('action', 'like');
            if (model) {
              model.set('isLiked', false);
              model.set('isDisliked', false);
            }
          }
          else if ('dislike' == verb) {
            $e.html('');
            if (model) {
              model.set('isLiked', false);
              model.set('isDisliked', true);
            }
           
            // remove from collection and view
            $e.parents('div.ithumb').each(function(index, el) {
              console.log('fadeout', el);
              $(el).fadeOut('slow');
              view.collection.remove(model);
              //view.render();
            });
          }
        }
        else {
          alert('an error occured saving taste model');
        }
      }
    });    
  }
}

var IThumbView = Backbone.View.extend({
  
  // pre-render for view-model
  preRender : preRenderArt,
  
  /* three states of 'like' button
   */
  /*
  clickThumb: function(e) {
    alert('click thumb');
    var t = $(e.currentTarget);
    if (t.hasClass('inactive')) {
      t.removeClass('inactive');
      t.addClass('positive');
    }
    else if (t.hasClass('positive')) {
      t.removeClass('positive');
      t.addClass('negative');
    }
    else {
      t.removeClass('negative');
      t.addClass('inactive');
    }
  },
  */
  
  imageMouseEnter: function(e) {
    var t = $(e.currentTarget);
    t.addClass('hover');
    var w = t.find('.inner img').width();
    t.find('.over').width(24 + w).fadeTo(500,0.9);
    t.find('button.thumbs4').show();
    t.find('div.feedback').show();
  },
  
  imageMouseLeave: function(e) {
    var t = $(e.currentTarget);
    t.removeClass('hover').find('.over').hide();
    t.find('button.thumbs4').hide();
    t.find('div.feedback').hide();
  },
  
});


//----------------------------------------------------------------------
//
// Interest Tab View
//
//----------------------------------------------------------------------
var SuggestGridView = IThumbView.extend({

  itemsEl        : null,
    
  events : {
    'mouseenter .ithumb'    : 'imageMouseEnter',
    'mouseleave .ithumb'    : 'imageMouseLeave',
    //'click button.thumbs4'  : 'clickThumb',
    
    'click [rel="stream"]' : function(e) {
      e.preventDefault();
      var $t = $(e.currentTarget);
      
      var lid = $t.data('model-id');
      //var path = this.options.path;
      //app.router.navigate('#stream/' + lid, { trigger: true });
      app.router.navigate('#stream/' + lid, { trigger: true });
      
    }
  },
  
  render: function(promise) {
    var view = this;    

    // when collection is ready...
    $.when(promise).done(function(collection, sharedCollection) {    
      if (collection)
        view.collection = collection; // FIXME when render is called twice, collection is undefined for some reason
      view._render(sharedCollection);
    });
  },
  
  _render: function(sharedCollection) {
    var view = this;
    
    // create thumbnail view and render...
    var suggestView = new ThumbnailGalleryView({
      append      : false,
      collection  : this.collection, // pass it along...
      el          : this.itemsEl,
      preRender   : view.preRender
    });  
    suggestView.render();
    
    // first "new" recommendation tooltip
    if (false /* this doesn't work */) {
      $.when(suggestView.thumbsLoadedPromise).done(function() {
        var firstNew = view.$el.find('div.ithumb.new').first();
        if (0 < firstNew.length)
          view.$el.trigger('tooltip', {id: 'new-recom', el: firstNew});
      });
    }
    
    // infinite scroll
    //
    if (INFINITE_SCROLL) {
      var $bottom = this.$el.find('.bottom'); // this will change each render
      $bottom.waypoint(function(e, direction) {      
        
        if ('down' == direction) {
          
          if (view.isFetchMoreBlocked) 
            return;
            
          //console.log('.bottom', direction);  
          var $wrap = view.$el.find('.thumbs-wrap');
          
          if (0 == $wrap.length)
            return;

          // advance page
          var nextPage = view.collection.options.page + 1;
          
          console.log("fetching more... page = %s", view.collection.options.page);
          view.isFetchMoreBlocked = true;
          view.collection.options.page = nextPage;
          sharedCollection.expire();
          sharedCollection.makeReady({add:true});
          
          // infinite scrolling only to become active again
          // when the collection is done fetching..
          $.when(sharedCollection.promise).done(function() {
            view.isFetchMoreBlocked = false;
          });
          
          view.render(sharedCollection.promise);
          
        }    
      }, {offset: '110%'} );    
    }
  },
  
  initialize: function() {
    
    // provide grid events
    _.extend(this.events, GridEvents);
    
    // item container
    this.itemsEl = this.$el.find('[data-role="items"]');
  },
  
});


//----------------------------------------------------------------------
//
// Search Tab View
//
//----------------------------------------------------------------------
var SearchGridView = IThumbView.extend({
  
  items         : null,
  suggestions   : null,

  events : {
    'mouseenter .ithumb'    : 'imageMouseEnter',
    'mouseleave .ithumb'    : 'imageMouseLeave',
    //'click button.thumbs4'  : 'clickThumb',
    
    'likeArt'               : 'clickLike',
    'dislikeArt'            : 'clickDislike', 
    
    'click [rel="stream"]' : function(e) {
      e.preventDefault();
      var $t = $(e.currentTarget);
      
      var lid = $t.data('model-id');
      var path = this.options.path;
      app.router.navigate(path + '/' + lid, { trigger: true });
      //app.router.navigate('#stream/' + lid, { trigger: true });     
      
    },
  },
  
    
  clickLike: function() {
    var view = this;
    
    // create taste data
    var query = view.options.viewModel.get('query');
    var tasteData;
    if (query.artistid) {
      tasteData = {
        like: 'artist',
        artist : query.artistid,
      };    
    }
    else if (query.tag) {
      tasteData = {
        like: 'tag',
        tag : query.tag,
      };
    }
    console.log(query, tasteData);
    
    // optimistic
    view.controlModel.set({thumbUp: true, thumbDown: false});
    
    // post feedback
    this.$el.trigger('postFeedback', { 
        data      : tasteData, 
        callback  : function(err, taste) {          
          if (!err) {
            console.log("SUCCESS", taste);
            //model.set({isLiked: 1});
          }
          else {
            view.controlModel.set({thumbUp: false, thumbDown: false});
          }
        } 
    });
  },
  
  clickDislike: function() {
    var view = this;
    
    // create taste data
    var query = view.options.viewModel.get('query');
    var tasteData;
    if (query.artistid) {
      tasteData = {
        dislike: 'artist',
        artist : query.artistid,
      };    
    }
    else if (query.tag) {
      tasteData = {
        dislike: 'tag',
        tag : query.tag,
      };
    }
    console.log(query, tasteData);
    
    // optimistic
    view.controlModel.set({thumbUp: false, thumbDown: true});
    
    // post feedback
    this.$el.trigger('postFeedback', { 
        data      : tasteData, 
        callback  : function(err, taste) {          
          if (!err) {
            console.log("SUCCESS", taste);
          }
          else {
            view.controlModel.set({thumbUp: false, thumbDown: false});
          }
        } 
    });
  },
  
  render: function() {    
    var view = this;
    
    // subscribe to toolbar commands
    this.$el.trigger('toolbar.subscribe', {
      view      : this, 
      callback  : function(controlModel) {
        view.controlModel = controlModel;
    }});
    this.$el.trigger('toolbar.reset', this);
    
    // query for taste data
    var query = view.options.viewModel.get('query');
    var queryData;
    if (query.tag)
      queryData = { tag: query.tag }
    else if (query.artistid)
      queryData = { artist: query.artistid }
      
    console.log('fetching taste data', queryData);
    var queryColl = new Leo.Collections.Tastes(null, queryData);
    queryColl.fetch({
      success: function(c, r) {
        console.log('taste from server', c);
        if (0 < c.size()) {
          if (c.at(0).isLike())
            view.controlModel.set({thumbUp: true, thumbDown: false});
          else if (c.at(0).isDislike()) 
            view.controlModel.set({thumbUp: false, thumbDown: true});
          else
            view.controlModel.set({thumbUp: false, thumbDown: false});
        }
        else {
          view.controlModel.set({thumbUp: false, thumbDown: false});
        }
      }
    });
    
    // render when collection is ready
    var promise = this.options.viewModel.get('sharedPromise').promise;
    $.when(promise).done(function(collection) {  
      view.collection = collection;
      var thumbsView = new ThumbnailGalleryView({
        el          : view.items,
        collection  : collection,
        preRender   : view.preRender
      }); 

      // render
      thumbsView.render();
      
      // FIXME infinite scroll
      //
      if (false && INFINITE_SCROLL) { 
        var $bottom = view.$el.find('.bottom'); // this will change each render
        $bottom.waypoint(function(e, direction) {
          if ('down' == direction) {
            console.log('down!');
          }
        }, {offset: '110%'} );
      }
    });
  },
  
  initialize: function() {
    // provide grid events
    _.extend(this.events, GridEvents);
    
    // thumbnail container
    this.items = this.$el.find('[data-role="items"]');  
    
  },  
});


function updateMeta(view, searchModel, collection, isMainHeader) {
  var query = searchModel.get('query');
  //console.log('query',query);
  if (query.artistid) {
    var first = collection.at(0).toJSON();
    var label = 'Art by ' + first.artist; 
    return label;
  }
  else if (query.tag) {
    var first = collection.at(0).toJSON();
    for (var i = 0; i < first.tags.length; i++) {
      if (first.tags[i].tag == query.tag) {
        var label = 'Art with tag "' + first.tags[i].tagtext + '"';  
        return label;
      }
    }
  }
  else if (query.similar) {
    return "Similar to ...";    
  }
  return false;
}

//----------------------------------------------------------------------
//
// Gallery Tab View
//
//----------------------------------------------------------------------
var GalleryTabView = Backbone.View.extend({
  
  render: function(lid, promise) {
    var view = this;
    
    // force scroll to top
    $(window).scrollTop(0);
    
    // when collection is ready...
    $.when(promise).done(function(collection) {
      
      // create subview
      view.$el.off();
      var streamView = new GalleryStreamView({el: view.$el, collection: collection });
      
      // save for later
      view.streamView = streamView;
      
      // render stream
      streamView.render(lid);
      
    });
  }
});

//----------------------------------------------------------------------
//
// Home Tab View
//
//----------------------------------------------------------------------
var HomeTabView = Backbone.View.extend({

  items             : null,
  recommendations   : null,

  render: function() {
    var view = this;
    
    // default categories
    if (true) {
      
      // recent likes
      var likesCollection       = new Leo.Collections.Likes();
      var likesView             = new ThumbnailGalleryView({
        length: 10,
        collection: likesCollection, 
        el        : this.items,
        template: '#taste-thumbs-template', 
        label: 'Recent likes...'});  
      likesCollection.fetch();
      
      // recommendations
      var streamRecommendations = new Leo.Collections.StreamRecommendations();
      var recommendationsView   = new ThumbnailGalleryView({
        length: 10,
        collection: streamRecommendations, 
        el        : view.recommendations,
        template: '#taste-thumbs-template', 
        label: 'You might also like...'
      });
      streamRecommendations.fetch();
    }
    
    // topTastes
    if (true /* top tastes */) {
      view.otherItems.html('');
      
      
      // deferred for user tastes
      //
      var fetchUserTastes = function(global) {
        var defered = new $.Deferred();
        var tastes = new Leo.Collections.RecommendationTopTastes(null, { global: global ? 1: 0} );
        tastes.fetch({
          success: function(coll) {
            if (0 < coll.length) 
              defered.resolve(tastes, global);
            else
              defered.reject(tastes, global);
        }});
        return defered.promise();
      };
      
      $.when(fetchUserTastes(false)).then(      
        handleItems, // success
        
        // fail
        function() {
          console.log('fetchUserTastes fail');          
          $.when(fetchUserTastes(true)).done(handleItems);
        }
      );
      
      /*
      var topTastes = new Leo.Collections.RecommendationTopTastes(null, { global: 1} );
      topTastes.fetch({
        success: function(coll) {
          if (0 < coll.length) 
            promise.resolve();
          else
            promise.reject();
      
      topTastes.fetch({
        success: function(coll) {   
      */
      function handleItems(coll, global) {
        var randomCols = /*_.shuffle*/(coll.models);
               
        var prefix = global ? ' (global) ' : '';
        var quota = { 0: 2, 2: 2, 4: 2 };
        randomCols.forEach(function(taste) {
          
          console.log('taste', taste);
          
          var verb = taste.get('verb');
          //console.log('verb', verb);
          if (quota[verb]) {
            quota[verb] --;
          }
          
          if (0 == quota[verb]) {
            return;
          }
          
          var tasteColl = new Leo.Collections.RecommendationByTaste(null, {tasteid: taste.id} );
          
          // fix header
          var header = Leo.util.tasteString(taste);
          header.desc = header.desc + prefix;
          console.log('header = ', header);
          var tasteCollView = new ThumbnailGalleryView({
            collection: tasteColl, 
            length: 10,
            template: '#taste-thumbs-template', 
            header: header
          });      
        
          tasteCollView.on('rendered', function() {
            //console.log('done!', likesView.el);
            view.otherItems.append(tasteCollView.el);
          });
          
          tasteColl.fetch();
    
              
        });
      }
    }
    
  },
  
  initialize: function() {
    this.items                = this.$el.find('[data-role="items"]');
    this.recommendations      = this.$el.find('[data-role="recommendations"]');
    this.otherItems           = this.$el.find('[data-role="other"]');
  },
  
});

//----------------------------------------------------------------------
//
// Cart Tab View
//
//----------------------------------------------------------------------
var CartTabView = Backbone.View.extend({

  items         : null,
  suggestions   : null,

  render: function() {
    
    // recommendations
    var cartCollection        = new Leo.Collections.Cart(null, {});
    var itemsView             = new ThumbnailGalleryView({el: this.items, collection: cartCollection});      
    cartCollection.fetch();
    
    // likes
    var cartRecommendations   = new Leo.Collections.CartRecommendations(null, {});
    var cartView              = new ThumbnailGalleryView({el: this.suggestions, collection: cartRecommendations});
    cartRecommendations.fetch();
    
  },
  
  initialize: function() {
    this.items                = this.$el.find('[data-role="items"]');
    this.suggestions          = this.$el.find('[data-role="recommendations"]');
  },
  
});


//----------------------------------------------------------------------
//
// Single Tab View
//
//----------------------------------------------------------------------


var SingleTabView = FlaggingView.extend({
  
  render: function(lid) {

    console.log('singletabview:render', lid);
   
    this.$el.find('.row').hide();
    
    var view = this;
    var model = this.options.viewModel.get('model');
    console.log('model = ', model);
    if (!model || model.get('id') !== lid) {      
      serverModel = new Leo.Models.Art({id: lid});     
      serverModel.on('change', function() {        
        
        console.log('change:model');
        view.options.viewModel.set({model: serverModel});
        
        //view.render(model);        
      });
      
      serverModel.fetch();
    }
  },
  
  initialize: function() {
    
    // init sub-view
    this.singleView = new SingleView({el: this.$el, viewModel: this.options.viewModel});
   
  },
  
});


//----------------------------------------------------------------------
//
// Suggest Tab View
//
//----------------------------------------------------------------------
var SuggestTabView = FlaggingView.extend({
  
  streamView    : null,
  suggestModel  : new SuggestModel(),
  isRendered    : false,
  
  render: function() {
    var view = this;
    
    if (this.isRendered)
      return;
    this.isRendered = true;

    // recommendation collection
    var recoms = new Leo.Collections.StreamRecommendations(null, {});
    
    // view
    this.streamView = new GalleryStreamView({el: $('#suggest'), collection: recoms, suggestModel: this.suggestModel});
    
    // binding for viewmodel
    this.suggestModel.on('change:isInvalid', function(val) {      
      console.log('change:isInvalid', val);
      if (val.get('isInvalid')) {
        // view.galleryView.newCollection();
      }
    });

    // render stream
    view.streamView.render();
  },
  
});


//----------------------------------------------------------------------
//
// Thumbnail Gallery View
//
//----------------------------------------------------------------------

var ThumbnailGalleryView = Backbone.View.extend({

  // ## cached template
  //
  template: null,
  
  thumbsLoadedPromise: void 0,
  
  // render items
  render: function() {   
    var view = this;
    
    var loadedDeferred = $.Deferred();
    view.thumbsLoadedPromise = loadedDeferred.promise();
    
    // clear content
    if (!this.options.append) {
      this.$el.html('');
    }
    
    // get template, use cached version
    if (!this.template) {
      var templateRef   = this.$el.data('template');
      this.template  = $(templateRef).text();
    }
    
    // change view-model to simple dict
    var items = this.collection.toJSON();

    // don't render template if there are NO items...
    if (0 < items.length) {
      
      // hook
      if (this.options.preRender) {
        items = this.options.preRender(items);
      }
    
      // create template context      
      var context = _.extend(this.options, { art: items });
      
      // run template
      var html = Mustache.render(this.template, context,
        { thumb: $('#ithumb-image-template').text() } // partials
      );
      

      
      // append or replace
      if (true == this.options.append) {         
        this.$el.append(html);
      }
      else {
        this.$el.html(html); 
      }
      
      // trigger when all done
      var numImages = items.length;
      
      //console.log('looking for images', view.$el, view.$el.find('img.art'));
      view.$el.find('img.art')
        .load(function() {   
          numImages--;
          if (0 == numImages)
            loadedDeferred.resolve();
        })
        .each(function() { // IE hack
          if(this.complete) $(this).trigger("load");
        });
    }
    
    // sticky sub-header
    //if (INFINITE_SCROLL) {
    //  $('div.subnav').waypoint(function(e, direction) {
    //    var $t = $(e.currentTarget);
    //    $t.toggleClass('sticky', direction === "down");
    //  });
    //}
      
    return this;    
  },
  
  initialize: function() {    
    this.template = $(this.options.template).text();
  }  
});


var CommandEvents = {
  
  'clickLike' : function() {
    alert('clicklike');
  },
  
  
};

// ## Single View
//
var SingleView = Backbone.View.extend({
    
  // ## post feedback
  //
  xxpostFeedback: function(isLike) {
    
    var view = this;
    
    // get current model
    var model = this.options.viewModel.get('model');     
    
    // like the LID
    var taste = new Leo.Models.Taste({
      lid   : model.id
    });
    
    if (isLike)
      taste.set('like', 'lid')
    else
      taste.set('dislike', 'lid')
      
    console.log(taste);
    
    // save taste
    taste.save(null, {
      success: function() {
        //view.invalidate();
      },
      error: function() {
        alert('error saving taste');
      }
    });  
    
    
    return this;
  },
  
  // render current image at index
  render: function(model) {
    
    console.log("SingleView::render");
    
    // get model
    var model = this.options.viewModel.get('model');
    
    if (!model) {
      console.log("no model yet for recommendation view");
      return;
    }
    
    // too many closures ahead!
    var view = this;
    
    //if (document.getElementById('stream-row')) {
    //  hideStreamImage(showStreamImage);
    //}
   // else {
      showStreamImage();
    //}
    
    //showStreamImage();
    
    function hideStreamImage(callback) {
        
      view.$el.find('.row').fadeOut('slow', function() {  
      //$('#stream-row').fadeOut('slow', function() {  
        //view.$el.find('[data-rel="art"]').html('');
        if (callback)
          callback();
      });
    }
    
    function showStreamImage() {
      
      // IMAGE: get template
      if (!view.template) {
        var templateRef   = view.artEl.data('template');
        view.template  = $(templateRef).text();
      }
      
      // IMAGE: create + insert HTML
      var models = preRenderArt([model.toJSON()]);
      var modelData = models[0];
      var html = Mustache.render(view.template, modelData);
      view.artEl.html(html);
      
      // INFO: get template
      if (!view.infoTemplate) {
        var infoEl = view.options.infoEl;
        var templateRef   = view.artInfoEl.data('template');
        view.infoTemplate  = $(templateRef).text();        
      }
      
      // INFO: create + insert HTML
      var jsonModel = modelData; // model.toJSON();
      
      html = Mustache.render(view.infoTemplate, 
        _.extend(
          jsonModel,
          { like : 
            { verb: 'like', lid: jsonModel.id, text: 'Like', href: '#' }
          }
        )
      );
      view.artInfoEl.html(html);
      
      // supersize
      view.$el.find('[data-rel="stream-image"]').fullScreenBG({callback: function() {
        //$('#stream-loader').fadeOut('slow'); 
      }});    
      
      //fadeInImage('#stream-image', function() {});
      
 
      // save current model
      view.currentModel = model;
         
      view.$el.find('.row').fadeIn('slow', function() {       
        // show the thumbnails
        //view.collection.trigger('showStreamImage', 1 + view.index);
      });
    }
      
    return this;    
  },
  
  initialize: function() {
    var view = this;
    
    // subviews
    this.artEl       = this.$el.find('[data-rel="art"]');
    this.artInfoEl   = this.$el.find('[data-rel="art-info"]');
      
    // backed by view-model
    this.options.viewModel.on('change:model', function(e, model) {
      console.log('change:model', model);
      view.render();
    });
      
  }
  
});

/**
 * GalleryStreamView
 */
var GalleryStreamView = Backbone.View.extend({

  // ## events
  //
  events: {
    
    'nextArt' : function(e) {
      e.preventDefault();
      console.log('nextArt', this);
      this.clickNext();
    },

    'prevArt' : function(e) {
      e.preventDefault();
      this.clickPrev();
    },
       
    'likeArt' : 'clickLike',
    
    'dislikeArt' : 'clickDislike', 
    
    'xclick a.leo-addcart' : function(e) {
      e.preventDefault();
      this.clickAddCart();
    },
  },
  
  // ## cached template
  //
  template: null,
  
  // ## current index in art collection
  index: 0,
  
  // ## get artwork in the current view
  //
  current : function() {
    this.collection.at(this.index);
  },
  
  // ## dislike the art
  clickDislike: function() {
    var view = this;
    var model = this.collection.at(this.index);    
    var tasteData = {
      dislike : 'lid',
      lid     : model.id,
    };
    
    // optimistic
    view.controlModel.set({thumbUp: false, thumbDown: true});
    
    // post feedback
    this.$el.trigger('postFeedback', { 
      data    : tasteData, 
      callback: function(err, taste) {        
        if (!err) {
          console.log("SUCCESS", taste, model);
          model.set({isLiked: 0});
        }
        else {
          view.controlModel.set({thumbUp: false, thumbDown: false});
        }
      }
    });
  },
  
  // ## like the art
  //
  clickLike: function() {
   
    var view = this;
    
    console.log('clickLike');
    
    var model = this.collection.at(this.index);   
    console.log('model & index', model, this.index); 
    var tasteData = {
      like: 'lid',
      lid : model.id,
    };    
    
    // optimistic
    view.controlModel.set({thumbUp: true, thumbDown: false});
    
    // post feedback
    this.$el.trigger('postFeedback', { 
        data      : tasteData, 
        callback  : function(err, taste) {          
          if (!err) {
            console.log("SUCCESS", taste, model);
            model.set({isLiked: 1});
          }
          else {
            view.controlModel.set({thumbUp: false, thumbDown: false});
          }
        } 
    });
  },
  
  xxxclickAddCart: function() {
    
    var model = this.currentModel;
    
    console.log('add cart', model);
    model.putIntoCart();
    alert('Added to Cart. Thanks!');
  },

  // ## next image
  //
  clickNext: function() {    
    this.index++;     
    // check bounds
    if (this.collection.length <= this.index)
      { /* noop */ }
    else
      this.render();
  },
  
  // ## previous image
  //
  clickPrev: function() {    
    this.index--;
    // check bounds
    if (0 <= this.index)
      this.render()
    else
      this.index = 0;
  },
  
  // render current image at index
  render: function(lid) {
    var view = this;
    
    // subscribe to toolbar commands
    this.$el.trigger('toolbar.subscribe', {
      view      : this, 
      callback  : function(controlModel) {
        view.controlModel = controlModel;
    }});
    this.$el.trigger('toolbar.reset', this);
    
    // tooltip
    $('#xxheaderlink').grumble(
      {
        text: 'Click back to grid view...', 
        angle: 235,
        hideOnClick: true,
        type: 'alt-',  
        distance: 0, 
        showAfter: 1000,
        hideAfter: false,
      }
    );
    
    // get current model
    //
    var model;
    if (lid) {
      model = this.collection.get(lid);
      // find index
      this.collection.each(function(item, i) {
        if (model.id == item.id) {          
          view.index = i;
          console.log('[init] index', view.index);
        }
      });
    }
    else
      model = this.collection.at(this.index);
   
    // no model found
    if (!model) {
      console.log("no model yet for recommendation view");
      return;
    }
    
    // update controls based on model like or dislike
    if (model.get('isLiked')) 
      view.controlModel.set({thumbUp: true, thumbDown: false});
    else if (model.get('isDisliked'))
      view.controlModel.set({thumbUp: false, thumbDown: true});
    else 
      view.controlModel.set({thumbUp: false, thumbDown: false});
   
    // show row and image
    if (document.getElementById('stream-row')) {
      hideStreamImage(showStreamImage);
    }
    else {
      showStreamImage();
    }
    
    function hideStreamImage(callback) {  
        
      view.$el.find('.row').fadeOut('slow', function() {  
      //$('#stream-row').fadeOut('slow', function() {  
        //view.$el.find('[data-rel="art"]').html('');
        if (callback)
          callback();
      });
    }
    
    function showStreamImage() {
      
      // remove tooltips 
      var $info = view.$el.find('ul.flags');
      $($info).grumble('delete');
      
      // get template
      if (!view.template) {
        var templateRef   = view.artEl.data('template');
        view.template  = $(templateRef).text();
      }      
      if (!view.template) {
        console.error('no view template!');
        return;
      }
      
      // render large image
      var html = Mustache.render(view.template, model.toJSON());
      view.artEl.html(html);
      
      // render art info template
      if (!view.infoTemplate) {
        var infoEl = view.options.infoEl;
        var templateRef   = view.artInfoEl.data('template');
        view.infoTemplate  = $(templateRef).text();        
      }
      
      var models = preRenderArt([model.toJSON()]);
      modelData = models[0];
      html = Mustache.render(view.infoTemplate, modelData);
      view.artInfoEl.html(html);
      
      // special view for tag lists
      var tagView = new TagListView({el: view.$el.find('ul.flags'), model: model});
      //console.log('tagView', view.$el, view.$el.find('ul.flags'));
      
      // supersize
      var loadingDone = showLoading();
      view.$el.find('[data-rel="stream-image"]').fullScreenBG({callback: function() {
        loadingDone(); 
      }});    
      
      //fadeInImage('#stream-image', function() {});
      
 
      // save current model
      //view.currentModel = model;
      
      // 'seen' it
      //model.markSeen();
         
      view.$el.find('.row').fadeIn('slow', function() {       
        // show the thumbnails
        //loadingDone(); 
        //view.collection.trigger('showStreamImage', 1 + view.index);
        
        // tooltip
        //var $info = view.$el.find('[data-rel="art-info"]');
        $info = view.$el.find('ul.flags');
        console.log('info', view.$el, $info);
        view.$el.trigger('tooltip', {id: 'taglist', el: $info});
      
      });
      
      
      
    }
      
    return this;    
  },
  
  initialize: function() {
    
    // get subview elements
    this.artEl       = this.$el.find('[data-rel="art"]');
    this.artInfoEl   = this.$el.find('[data-rel="art-info"]');
    
  }
  
});

var TagListView = Backbone.View.extend({
  
  events: {
    
    'click [rel="artist-taste"]' : function(e) {
      e.preventDefault();
      var view = this;
      $t = $(e.currentTarget);
      
      // get taste id
      tasteid = $t.data('tasteid');
      artist  = $t.data('artist');
      
      console.log('artist taste', artist, tasteid, view.model)
      
      if (tasteid) {
        
        // remove this taste with this LID
        
        $t.removeClass('active');
        $t.addClass('inactive');
        
        // remove model from the servers collection
        var tasteModel = new Leo.Models.Taste({
          id: tasteid
        });
        
        console.log('destroying...', tasteModel);
        // TODO check the return status
        tasteModel.destroy();      
        
        // remove tasteid
        $t.data('tasteid', '');
        
      }
      else {
        
        // create new taste
        var tasteModel = new Leo.Models.Taste({
          'like'  : 'artist',
          'artist': artist,
          'lid'   : view.model.id
        });
        
        tasteModel.save(null, {
          success: function(model, response) {
            // mock new tasteid
            $t.data('tasteid', model.id);
            
            // update style
            $t.removeClass('inactive');
            $t.addClass('active');
        
          },
          error: function() {
            console.log("ERROR occured saving/creating taste");
          },
        });
      }
    },
    
    'click [rel="tag-taste"]' : function(e) {
      var view = this;
      e.preventDefault();
      $t = $(e.currentTarget);
      
      // get taste id
      tasteid = $t.data('tasteid');
      tag     = $t.data('tag');
      
      console.log('tag taste', tag, tasteid, view.model);
      
      if (tasteid) {
        
        // remove this taste with this LID
        
        $t.removeClass('active');
        $t.addClass('inactive');
        
        // remove model from the servers collection
        var tasteModel = new Leo.Models.Taste({
          id: tasteid
        });
        
        console.log('destroying...', tasteModel);
        // TODO check the return status
        tasteModel.destroy();      
        
        // remove tasteid
        $t.data('tasteid', '');
        
      }
      else {
        
        // create new taste
        var tasteModel = new Leo.Models.Taste({
          'like' : 'tag',
          'tag'  : tag,
          'lid'  : view.model.id
        });
        
        tasteModel.save(null, {
          success: function(model, response) {
            // mock new tasteid
            $t.data('tasteid', model.id);
            
            // update style
            $t.removeClass('inactive');
            $t.addClass('active');
        
          },
          error: function() {
            console.log("ERROR occured saving/creating taste");
          },
        });
      }
    }
  }
});

function showLoading() {
  var $loading = $('<div class="loading">Loading...</div>');
  $('body').append($loading).data('loading', true); 
  return function() {
    // fade out, then remove
    $loading = $('body div.loading');
    $loading.fadeOut(function() {
      $loading.remove();   
    });
  };
}
          
          

var FullScreenView = Backbone.View.extend({

  
});

// Document Ready
//

$(document).ready(function() { 
  
  console.log('document ready...');
  
  // determine api url
  var loc       = $(location).attr('hostname');
  var protocol  = $(location).attr('protocol');
  
  if (0 == loc.indexOf('127.0.0.1') || 'file:' == protocol )
    Leo.options.api = 'http://127.0.0.1:8126';  // local testing    
  //console.log("API location: %s", Leo.options.api);
  
  // start app
  app = new AppView({el: $('body')});
  
});

// ## fade-in image utility
//
function fadeInImage(img, callback) {
  $(img).load(function() {   
    $(this).fadeIn('slow', function() {
      if (callback)
        callback();
    });
  })
  .each(function() { // IE hack
    if(this.complete) $(this).trigger("load");
  });
}


// ## User Navbar View
//
var UserNavbarView = Backbone.View.extend({
  
  modal         : $('#login-modal'),
  clearModal    : $('#clear-modal'),
  username      : $('input[name="username"]'),
  cart          : new Leo.Collections.Cart(),
  tastes        : new Leo.Collections.Tastes(),
  
  events: {
  
    'click #sign-out' : function(e) {
      this.modal.modal('show');   
      this.username.focus();
    },
    
    'click #clear-tastes': function() {
      this.clearModal.modal('show');
    },
    
    'click #clear-cart': function(e) {
      
      e.preventDefault();
      
      // clear all the items in the cart
      var cartModel = this.cart.asModel();
      cartModel.destroy();
      
      alert('Shopping Cart is Empty :(');
    },
    
    'click #clear-all': function(e) {   
      e.preventDefault();   
      var tastes = this.tastes.asModel();
      var view = this;
      tastes.destroy({
        success: function() {
          console.log("success destroy!");
          window.location.reload();
        },
        error: function() {
          console.log("error destroy");
          window.location.reload();
        }});      
    },
    
    'click #sign-in-button': function(e) {   
      e.preventDefault();  
      
      // get new agent name
      var username = this.$el.find('input[name="username"]').val();
      console.log('attempting login', username);
      
      if (username && 0 < username.length) {
        
        // inform the client lib
        Leo.options.agent       = username;
        Leo.options.agentName   = Leo.options.agent;
        
        // set the cookie for return visits
        console.log('setting cookie...');
        var cookie = new jecookie('leo-agent');
        cookie.data = Leo.options.agent;
        cookie.save();
        
        // update UI
        //this.render();
        window.location.reload();
      }
      
      return false;
    },
    
  },
  
  render: function() {    
    // update username in UI
    $('#user-name').text(Leo.options.agentName);
  },
  
 initialize: function() {
    
    // setup modals
    //
    this.modal.modal({show: false});
    this.modal.modal('hide');
    
    this.clearModal.modal({show: false});
    this.clearModal.modal('hide');
    
    // setup agent
    //
    console.log('setting cookie...');
    var cookie = new jecookie('leo-agent');
    if(cookie.load()) // cookie exists
    {
      Leo.options.agent       = cookie.data;
      Leo.options.agentName   = Leo.options.agent;
    }    
    else // cookie does not exists
    {
      // generate random agent string
      var num = Math.floor(Math.random() * 1000000);
      var agent = 'user_' + num.toString(26);
      console.log('agent', agent);
      Leo.options.agent = agent;
      Leo.options.agentName = "Guest";
      
      // save agent cookie
      cookie.data = Leo.options.agent;
      cookie.save();
      
      //this.modal.modal('show');   
      //this.username.focus();
    } 
    
    // render
    this.render();
  }  
  
});
  

