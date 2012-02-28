$(document).ready(function() {
	//killStorage("playlists");
	//killStorage("playlist1");
	//killStorage("playlist2");
	//killStorage("playlist3");
	//killStorage("playlist4");
	//killStorage("playlist5");
  var resizeTimer;
  $(window).bind('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 100);
  });

function resize() {
  var YouTubeIframe = $('#video_player')
  //dont do anything for now letting media query provide two sizes - will put function here if we need continuous resizing
}

  window.YouTubePlayerView = Backbone.View.extend({

    initialize: function(options) {
      this.apiReady = 0;
      this.panelShowing = 0;
      this.vent = options.vent;
      this.videoTemplate = _.template($('#video_info_template').html());
      this.videoInfo = $('#video_info');
    },
    

    playSong : function(song, msg) {
      this.currentSong = song;
      url = song.get("song_id");
      if (msg) {
        this.msg = msg;
      } else {
        this.msg = "";
      }
      if (this.apiReady) {
        if (this.player) {
          this.player.loadVideoById(url);
        } else if(url) {
        this.player = new YT.Player('video_player', {
          width: 640,
          height: 480,
          videoId: url,
          events: {
           'onReady': YouTubePlayer.playerReady,
           'onPlaybackQualityChange': YouTubePlayer.playerReady,
           'onStateChange': YouTubePlayer.stateChanged,
           'onError': YouTubePlayer.errorz
         }
       });
        }
      } else {
        alert("Youtube API not ready");
      }
    },

    errorz: function(event) {
      alert("some kind of error");
    },

   stateChanged: function(event) {
     if (event.data == YT.PlayerState.ENDED) {
       if(YouTubePlayer.msg === "playedOnItsOwn") {
         YouTubePlayer.vent.trigger("videoEnded", YouTubePlayer.currentSong); //send the song that was just played
       } else {
         YouTubePlayer.vent.trigger("videoEnded"); //otherwise let the playlist figure out what to play next
       }
     }
   },

   playerReady: function(event) {
     YouTubePlayer.player.playVideo();
     YouTubePlayer.videoInfo.html(YouTubePlayer.videoTemplate({title: YouTubePlayer.currentSong.get('title')}));
   }

  });

  var vent = _.extend({}, Backbone.Events);
  window.YouTubePlayer = new YouTubePlayerView({vent: vent});

	function killStorage(name) {
        for (var i = localStorage.length - 1; i >= 0; i--) {
            var key = localStorage.key(i);
            if (key.indexOf(name) !== -1) {
                localStorage.removeItem(key);
            }
        }
    }
   /*
	 * song model
	 */
	
	var Song = Backbone.Model.extend({
	});
	
	/*
	 * songs collection
	 */
	
	var Songs = Backbone.Collection.extend({
		model: Song,
		
		localStorage: new Store(""),
		
		initialize: function() {
		},
		
		setLocalStore: function(order) {
     		var localKey = "playlist"+order;
            this.localStorage = new window.Store(localKey);
   		},

	 
		nextOrder: function() {
				if (this.length === 0) return 1;
      			return this.last().get('order') + 1;
		}
    
   
	});
     
	window.Playlist = Backbone.Model.extend({
			defaults: {
				name: "New PlayList",
			},
			
			initialize: function () {
				this.songs = new Songs();
				this.songs.setLocalStore(this.get('order'));
				this.songs.fetch();
			},
			
			
			addSong: function (songToAdd, playListNumber) {
					var newSong = new Song(songToAdd.toJSON());
					newSong.set({'order': this.songs.nextOrder()});
					newSong.set({'playListNumber': playListNumber});
					this.songs.create(newSong);
					this.songs.last().save();	
			},
			
			playlistDuration: function () {
				var totalDuration = 0;
				_.each(this.songs.models, function(song){
					totalDuration = totalDuration + song.get('actual_duration');
				}, this);
				return Math.floor(totalDuration/60);
			}
	});
	
	//collection for playlists
	window.PlaylistCollection = Backbone.Collection.extend({
		model: Playlist,
		
		localStorage: new Store("playlists"),
		
		nextOrder: function () {
			if (this.length == 0) return 1;
      		return this.last().get('order') + 1;
		},
		comparator: function(todo) {
      		return todo.get('order');
    	}
	});
	
	window.playlists = new PlaylistCollection;
	playlists.fetch();
	
	//song View
	window.SongView = Backbone.View.extend({
		tagName: 'tr',
		
		events: {
			'click' : 'playSong',
		},
		
		initialize: function(options) {
			//TODO draggable
			_.bindAll(this, 'helperFn');
			$(this.el).draggable({ revert: true, helper : this.helperFn, appendTo: 'body'});
			$(this.el).data("song-model", this.model);
			//this.vent = options.vent;
		},
				
		render: function(oddRow) {
			if (oddRow) $(this.el).addClass('odd_row');
			else $(this.el).addClass('even_row');
			var eachSongTemplate;
			if (oddRow)	{
					eachSongTemplate = _.template($('#each_song_odd').html());
			}
			else {
					eachSongTemplate = _.template($('#each_song_even').html());
			}
							
			var songVariables = {"track": this.model.get('title'), "duration":this.model.get('duration'), "thumbnail": this.model.get('thumbnail')};
		    $(this.el).html(eachSongTemplate(songVariables));
			return this;
		},
		
		helperFn: function () {
			return $("<div class='draggable ui-draggable-dragging'>"+this.model.get('title')+"</div>");
		},
		
    playSong: function () {
      if(!YouTubePlayer.panelShowing) {
        YouTubePlayer.playSong(this.model, "playedOnItsOwn");
        YouTubePlayer.panelShowing = 1;
		  } else {
		    YouTubePlayer.playSong(this.model, "playedOnItsOwn");
		  }
		}

	});
	
	//playlist item view
	window.PlaylistView = Backbone.View.extend({
		template: _.template($('#playlist_template').html()),
		
		tagName: 'li',
		
		events: {
			'click' : 'playPlaylist'
		},
		
		initialize: function(options) {
		  _.bindAll(this, 'playNextSong', 'playListStopped', 'startedPlayList');
				$(this.el).droppable({
					hoverClass: "ui-state-active",
					drop: function( event, ui ) {
						var songDropped = $(ui.draggable).data("song-model");
						ui.helper.hide();
						//add the song to the playlist
						this.model.addSong(songDropped, this.model.get('order'));
				}.bind(this),
			});
			this.vent = options.vent;
			options.vent.bind("playNextSong", this.playNextSong);
			options.vent.bind("playListStopped", this.playListStopped);
			options.vent.bind("startedPlayList", this.startedPlayList);
			this.currentSong = -1;
		},
		
		playNextSong: function(order, song) {
		  if(order === this.model.get('order')){
		    if (song) {
		      this.currentSong = song.get('order'); //zero indexing
		      if(this.currentSong >= this.model.songs.length) {
            this.currentSong = 0;
          }
		    } else {
		      if(this.currentSong === -1) { // just starting the playList
		        this.currentSong =0;
		        YouTubePlayer.playSong(this.model.songs.models[this.currentSong]);
		        return;
		      }
		      this.currentSong += 1;
          if(this.currentSong >= this.model.songs.length) {
            this.currentSong = 0;
          }
        }
        YouTubePlayer.playSong(this.model.songs.models[this.currentSong]);
		  }
		},

    playListStopped : function() {
      this.currentSong = -1;
    },

    startedPlayList : function(order) {
      if( order != this.model.get('order')) {
        this.currentSong = -1;
      }
    },

		render: function () {
			var variables = {'name' : this.model.get('name')};
			$(this.el).html(this.template(variables));
			return this;
			$('#playlists').append($(this.el));
		},
		
		playPlaylist: function() {
      YouTubePlayer.panelShowing = 0;
      $('#search_results').hide();
      $('#playlist_view').show();
      this.showPlaylistInfo();
      this.vent.trigger("startedPlayList", this.model.get('order'));
		},

    showPlaylistInfo: function() {
			var templatePlaylist;
			var variables = {};
			var duration = "no time";
			$('#playlist_view').html('');
			if (this.model.songs.length == 0){//no songs
				templatePlaylist = _.template($('#playlist_info_template_no_songs').html());
			} else {
				templatePlaylist =  _.template($('#playlist_info_template').html());	
				variables = {"thumbnail1": this.model.songs.last().get('thumbnail')};
			}
			$('#playlist_view').append(templatePlaylist(variables));
			//title and duration
			
			var titleTemplate = _.template($('#playlist_info_template_general').html()); 
			variables = {"title":this.model.get('name'), "noOfSongs" : this.model.songs.length , "duration": this.model.playlistDuration()};
			$('#playlist_view').append(titleTemplate(variables));
			
			//add song list
			var songListTemplate = _.template($('#songs_list').html());
			$('#playlist_view').append(songListTemplate());
			
			var oddRow = true;
			
			_.each(this.model.songs.models, function(song){
							var songView = new SongView({model: song});
							$("#songs").append(songView.render(oddRow).el);
							if (oddRow) oddRow = false;
							else oddRow = true;
			});
		}

	});
	
	
	//playlists view
	window.AllPlaylistView = Backbone.View.extend({
		el: $('#left_nav'),
		initialize: function(options){
			//bind every function that uses this context
			_.bindAll(this, 'render','addNewPlayList', 'startedPlayList', 'playListStopped', 'videoEnded');
			//this.collection.bind('add',this.appendPlayList,this); //collection add event binder
      this.vent = options.vent;
      this.currentlyPlaying = -1;
      this.arrowShown = 0;
      this.arrowTop = -1;
      this.arrowTransitionSet = 0;
      this.arrow = $("#playlistSelected");
      options.vent.bind("startedPlayList", this.startedPlayList);
      options.vent.bind("playListStopped", this.playListStopped);
      options.vent.bind("videoEnded", this.videoEnded);
			this.render();

		},

    videoEnded : function(song) {
      if(this.currentlyPlaying != -1) {
        this.vent.trigger("playNextSong", this.currentlyPlaying, song);
      }
    },
  
    startedPlayList : function(order) {
      this.currentlyPlaying = order;
      if(this.arrowShown === 0) {
        var newTop = 115 + (order-1)*24;
        this.arrow.css("-webkit-transform"," translate(" + 0 + "px," + (newTop - this.arrowTop) + "px)");
        this.arrowShown =1;
      } else {
      	if(this.arrowTransitionSet === 0) {
      	    this.arrow.css("-webkit-transition", "all 1.0s");
      	    this.arrowTransitionSet = 1;
      	}
        var newTop = 115 + (order-1)*24;
        this.arrow.css("-webkit-transform"," translate(" + 0  + "px," + (newTop - this.arrowTop) + "px)");
      }
      this.vent.trigger("playNextSong", this.currentlyPlaying);
    },

    playListStopped : function() {
      this.currentlyPlaying = -1;
      this.arrowShown = 0;
      this.arrowTransitionSet = 0;
      this.arrow.css({"-webkit-transition": ""});
      this.arrow.css({"-webkit-transform": ""});
       // when something is searched reset all playlists
    },

		render: function(){
			_.each(playlists.models, function(playlist){
				//add each playlist
			    this.appendPlaylist(playlist);
			},this);

		},

		appendPlaylist: function (playlist) {
			var singlePlaylistView = new PlaylistView({model:playlist, vent : vent});
			$('#playlists').append(singlePlaylistView.render().el);
		},
		
		events: {
			'click #new_playlist': 'addNewPlayListTextBox',
			'keypress #newPlayListText': 'addNewPlayList'
		},
		addNewPlayListTextBox: function() {
			//show text box
			$('#newPlayListText').show();
			$('#newPlayListText').val('');
			$('#newPlayListText').focus();
		},
		
		addNewPlayList: function(e){
				if(e.keyCode==13){
	        		//add new playlist to collection
	        		$('#newPlayListText').hide();
	        		var name = $('#newPlayListText').val();
	        		var order = playlists.nextOrder();
	        		playlists.create({name:name, order:order}); //create a new model in the collection	
	        		//save the playlist to the collection
	        		playlists.last().save();
	        		
	        		this.appendPlaylist(playlists.last());
	        	}
	
		}
	});
	
	var playListView = new AllPlaylistView({el:'#left_nav', vent: vent});
	
	var SongSearchResultView = Backbone.View.extend({
		template: _.template($('#search_result_template').html()),
		
		initialize: function() {
			_.bindAll(this, 'helperFn');
			$(this.el).addClass('search_result_item');
			$(this.el).draggable({ revert: true, helper : this.helperFn, appendTo: 'body'});
			$(this.el).data("song-model", this.model);
		},
		
		render: function () {
			$(this.el).html(this.template(this.model.toJSON()));
			return this;
		},
		
		events : {
			'click .thumbnail' : 'playSong'
		},
		add: function () {
			var variables = {'duration' : this.model.get('duration')};
			$(this.el).html(this.template(variables));
			$('#search_results').append($(this.el));
		},
		
		helperFn: function () {
			return $("<div class='draggable ui-draggable-dragging'>"+this.model.get('title')+"</div>");
		},
		
		playSong: function() {
      if(!YouTubePlayer.panelShowing) {
        YouTubePlayer.panelShowing = 1;
        YouTubePlayer.playSong(this.model);
      } else {
        YouTubePlayer.playSong(this.model);
      }
		}

	});
	
	var SearchResultView = Backbone.View.extend( {
		initialize: function(options){
				$('#search_bar').val('');
				this.maxResults = 10;
				this.vent = options.vent;
		},
		
		events: {
				'keypress #search_bar': 'searchQuery'
		},
		searchQuery: function(e){
			if(e.keyCode==13){
	        	var query = $('#search_bar').val();
	        	this.fetchQuery(query);
	        	this.vent.trigger("playListStopped");
	        }
		},
		fetchQuery : function(query) {
			//fetch youtube videos
	 		var url = "https://gdata.youtube.com/feeds/api/videos?q="+query+"&max-results="+this.maxResults+"&v=2&alt=jsonc&callback=?";
			$.getJSON(url, function(data) {
				this.populate(data);
			}.bind(this));
		},
		
		populate: function(data){
		        //make song models
		        YouTubePlayer.panelShowing = 0;
		        $('#search_results').html('');
		        $('#playlist_view').hide();
		        $('#search_results').show();
		        /*$("#search_results").animate({
    						top: "50px",
  				}, 1500 );*/
				$.each(data.data.items, function(index, song) { 
  						this.addEachSong(song);
				}.bind(this));
		},
		
		addEachSong: function (item) {
			var duration = this.durationForSong(item.duration);
			var song = new Song;
			song.set({'title':item.title});
			song.set({'thumbnail':item.thumbnail.sqDefault});
			song.set({'duration':duration});
			song.set({'song_id': item.id});
			song.set({'actual_duration': item.duration});
			var songView = new SongSearchResultView({model:song});
			$('#search_results').append(songView.render().el);
		},
		
		durationForSong: function(secs) {
			var hrs = Math.floor(secs/3600);
			var rem = secs % 3600;
			var min = Math.floor(rem/60);
			secs = rem % 60;
			var str = "";
			if (hrs > 0 ){
				str = hrs.toString() + ":";
			}
			
			var secsStr = secs.toString();
			if (secs < 10 ){
				secsStr = '0' + secsStr;
			}
		    str = str + min.toString() +":"+ secsStr;
			return str;
		}
	});
	
	var searchView = new SearchResultView({el:'body', vent: vent});
	
});

      function onYouTubePlayerAPIReady() {
        YouTubePlayer.apiReady=1;
      }
      
