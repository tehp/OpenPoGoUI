(function() {
    var global = { 
        storage: {
            items: 350,
            pokemon: 250
        },
        snipping: false
    };
    window.global = global;
 
    global.config = window.configService.load();
    global.version = global.config.version;

    document.title += " - " + global.version;

    function confirmAndSendToServer(msg, callback) {
        if (!global.config.noConfirm) {
            vex.dialog.confirm({
                message: msg,
                callback: (value) => { if(value) callback(); }
            });
        } else {
            callback();
        }
    }

    $(function() {
        inventoryService.init(global.config.locale, launchApp);
    });

    function launchApp() {
        window.ga = window.ga || function() {};

        var sortBy = localStorage.getItem("sortPokemonBy") || "cp";
        $("#sortBy" + sortBy).addClass("active").siblings().removeClass("active");

        $("#pokemonLink").click( function() {
            if ($(".inventory").css("opacity") == "1" && $(".inventory .data .pokemon").length) {
                $(".inventory").removeClass("active");
            } else {
                global.ws.emit("pokemon_list");
            }
        });
        $("#eggsLink").click( function() {
            if ($(".inventory").css("opacity") == "1" && $(".inventory .data .egg").length) {
                $(".inventory").removeClass("active");
            } else { 
                global.ws.emit("eggs_list");
            }
        });
        $("#inventoryLink").click( function() {
            if ($(".inventory").css("opacity") == "1" && $(".inventory .data .item").length) {
                $(".inventory").removeClass("active");
            } else {
                global.ws.emit("inventory_list");
            }
        });

        $("#sortBypokemonId").click(() => global.map.displayPokemonList(null, "pokemonId"));
        $("#sortBycp").click(() => global.map.displayPokemonList(null, "cp"));
        $("#sortByiv").click(() => global.map.displayPokemonList(null, "iv"));

        $("#sortBypokemonId, #sortBycp, #sortByiv").click( function() {
            if(!$(this).hasClass("active")) {
                $(this).toggleClass("active").siblings().removeClass("active");
            }
        });

        $(".inventory .refresh").click(function() {
            console.log("Refresh");
            global.ws.emit(global.active + "_list");
        });

        $(".inventory .close").click(function() {
            $(this).parent().removeClass("active");
            $(".inventory .sort").hide();
        });

        $(".message .close").click(function() {
            $(this).parent().hide();
        });

        $(".close").click(() => { global.active = null });

        $("#recycleLink").click(() => {
            sessionStorage.setItem("available", false);
            window.location.reload();
        });

        $("#settingsLink").click(() => {
            global.map.saveContext();
            window.location = "config.html";
        });

        $(".inventory .data").on("click", "a.transferAction", function() {
            var parent = $(this).parent();
            var id = parent.data().id;
            var idx = global.map.pokemonList.findIndex(p => p.id == id);
            var selected = global.map.pokemonList[idx];
            var left = global.map.pokemonList.filter(p => p.pokemonId == selected.pokemonId).length - 1;
            var name = inventoryService.getPokemonName(selected.pokemonId);
            var msg = `Are you sure you want to transfer this ${name}? <br /> You will have <b>${left}</b> left.`;
            confirmAndSendToServer(msg, () => {
                ga("send", "event", "transfer", name);
                global.ws.emit("transfer_pokemon", { id: id });
                global.map.pokemonList.splice(idx, 1);
                parent.parent().fadeOut();
            });
        });

        $(".inventory .data").on("click", "a.evolveAction", function() {
            var parent = $(this).parent();
            var id = parent.data().id;
            var idx = global.map.pokemonList.findIndex(p => p.id == id);
            var selected = global.map.pokemonList[idx];
            var left = global.map.pokemonList.filter(p => p.pokemonId == selected.pokemonId).length - 1;
            var name = inventoryService.getPokemonName(selected.pokemonId);
            var msg = `Are you sure you want to evolve this ${name}? <br /> You will have <b>${left}</b> left.`;
            confirmAndSendToServer(msg, () => {
                ga("send", "event", "evolve", name);
                global.ws.emit("evolve_pokemon", { id: id });
                global.map.pokemonList.splice(idx, 1);
                parent.parent().fadeOut();
            });
        });
        
        $(".inventory .data").on("click", "a.favoriteAction", function() {
            var parent = $(this).parent();
            var id = parent.data().id;
            var idx = global.map.pokemonList.findIndex(p => p.id == id);
            var selected = global.map.pokemonList[idx];
            selected.favorite = !selected.favorite;
            var name = inventoryService.getPokemonName(selected.pokemonId);
            ga("send", "event", "favorite", name);
            $(this).find("img").attr('src', `./assets/img/favorite_${selected.favorite ? 'set' : 'unset'}.png`);
            parent.find(".transferAction").toggleClass("hide");
            global.ws.emit("favorite_pokemon", { id: id, favorite: selected.favorite });
        });

        $(".inventory .data").on("click", "a.dropItemAction", function() {
            var parent = $(this).parent();
            var itemId = parent.data().id;
            var name = inventoryService.getItemName(itemId)
            var count = parent.data().count;
            var msg = `How many <b>${name}</b> would you like to drop?`;
            vex.dialog.confirm({
                message: msg,
                input: `
                    <p class="range-field">
                        <input type="range" name="count" value="1" min="1" max="${count}" onchange="$('#display-range').text(this.value)" />
                    </p>
                    Drop: <span id='display-range'>1</span>
                `,
                callback: (value) => {
                    if(value) {
                        var drop = parseInt(value.count);
                        ga("send", "event", "drop_items", name);
                        global.ws.emit("drop_items", { id: itemId, count: drop });
                        if (count == drop) {
                            parent.parent().fadeOut();
                        } else {
                            parent.data("count", count - drop);
                            parent.parent().find(".count").text("x" + (count - drop));
                        }
                    }
                }
            });
        });

        $(".player").on("pogo:player_update", () => {
            if (global.player) {
                var player = $(".player");
                player.find(".playername .value").text(global.user);
                player.find(".level .value").text(global.player.level);
                var percent = 100*(global.player.experience - global.player.prev_level_xp)/(global.player.next_level_xp - global.player.prev_level_xp);
                player.find(".myprogress .value").css("width", `${percent.toFixed(0)}%`);
                player.show();
            }
        });

        if (global.config.websocket) {
            // settings ok, let's go
            global.map = new Map("map");
            global.map.loadContext();
            startListenToSocket();
        } else {
            // no settings, first time run?
            window.location = "config.html";
        }
    }

}());