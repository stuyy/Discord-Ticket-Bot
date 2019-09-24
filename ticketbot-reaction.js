/**
 * This code is for the SECOND and THIRD episode of the Ticket Bot Tutorial.
 * This code only handles role reactions and creates/closes the ticket channels based on that.
 * If you want the command version, please check "ticketbot-text.js"
 * By Anson, aka Stuy
 * Discord Server: https://discord.gg/tFaWNjF
 */

const discord = require('discord.js');
const client = new discord.Client();

const config = require('./config.json');

var userTickets = new Map();

client.login(config.token);

client.on('ready', () => {
    console.log(client.user.username + " has logged in.");
});

client.on('message', message => {
    /**
     * This first conditional statement is used to give reactions to the embed messages our bot sends.
     * Please note everything here is hard-coded, you are responsible for modifying it to fit your needs.
     */
    if(message.author.bot) {
        if(message.embeds.length === 1 && message.embeds[0].description.startsWith('React')) {
            message.react(':ticketreact:625925895013662721')
            .then(msgReaction => console.log('Reacted.'))
            .catch(err => console.log(err));
        }
        if(message.embeds.length === 1 && message.embeds[0].title === 'Ticket Support') {
            message.react(':checkreact:625938016510410772')
            .then(reaction => console.log("Reacted with " + reaction.emoji.name))
            .catch(err => console.log(err));
        }
    };
    /**
     * This was just used to send an initial embed message.
     * I copied the ID of the embed message sent and used that to check if reactions were
     * added to that. Check the 'raw' event.
     */
    if(message.content.toLowerCase() === '?sendmsg') {
        const embed = new discord.RichEmbed();
        embed.setAuthor(client.user.username, client.user.displayAvatarURL);
        embed.setDescription('React to this message to open a support ticket');
        embed.setColor('#F39237')
        message.channel.send(embed);
    }
});

/**
 * PLEASE NOTE: ticketreact and checkreact are my OWN custom emojis.
 * You need to modify it to match your own emojis.
 */
client.on('raw', payload => {
    if(payload.t === 'MESSAGE_REACTION_ADD') { // Check if the event name is MESSAGE_REACTION_ADD
        if(payload.d.emoji.name === 'ticketreact') // If the emoji is ticketreact
        {
            if(payload.d.message_id === '625926893954400266') { // Here we check if the id of the message is the ID of the embed that we had the bot send using the ?sendmsg command.
                let channel = client.channels.get(payload.d.channel_id) // Get the proper channel object.
                if(channel.messages.has(payload.d.message_id)) { // Check if the channel has the message in the cache.
                    return;
                }
                else { // Fetch the message and then get the reaction & user objects and emit the messageReactionAdd event manually.
                    channel.fetchMessage(payload.d.message_id)
                    .then(msg => {
                        let reaction = msg.reactions.get('ticketreact:625925895013662721');
                        let user = client.users.get(payload.d.user_id);
                        client.emit('messageReactionAdd', reaction, user);
                    })
                    .catch(err => console.log(err));
                }
            }
        }
        // Check if the emoji is checkreact, meaning we're deleting the channel.
        // This will only be significant if our bot crashes/restarts and there are additional ticket channels that have not been closed.
        else if(payload.d.emoji.name === 'checkreact') {
            let channel = client.channels.get(payload.d.channel_id);
            if(channel.messages.has(payload.d.message_id)) {
                return;
            }
            else {
                channel.fetchMessage(payload.d.message_id)
                .then(msg => {
                    let reaction = msg.reactions.get('checkreact:625938016510410772');
                    let user = client.users.get(payload.d.user_id);
                    client.emit('messageReactionAdd', reaction, user);
                })
                // Additional code that I did not need, but leaving it here for future purposes.
                /*
                .then(msg => msg.embeds.length === 1 && msg.embeds[0].title === 'Ticket Support' ? Promise.resolve(msg.channel) : Promise.reject('Incorrect Msg')
                ).then(ch => ch.delete('closing ticket'))
                .then(guildChannel => console.log("Deleted " + guildChannel.name))
                .catch(err => console.log(err)); */

            }
        }
    }
});

client.on('messageReactionAdd', (reaction, user) => {
    if(reaction.emoji.name === 'ticketreact') { // If the emoji name is ticketreact, we will create the ticket channel.
        /**
         * Here we need to check the map to see if the user's id is in there, indicating they have a ticket.
         * We also need to check if there are any other guild channels with their name concatenated with 's-ticket'. We need to 
         * check this case because the bot may have crashed or restarted, and their ID won't be stored in the map.
         */
        if(userTickets.has(user.id) || reaction.message.guild.channels.some(channel => channel.name.toLowerCase() === user.username + 's-ticket')) {
            user.send("You already have a ticket!"); // Send user msg indicating they have a ticket.
        }
        else {
            let guild = reaction.message.guild;
            // Create channel based on permissions. Note, you need to modify the permissionsOverwrites array to fit your needs for permissions.
            guild.createChannel(`${user.username}s-ticket`, {
                type: 'text',
                permissionOverwrites: [
                    {
                        allow: 'VIEW_CHANNEL',
                        id: user.id
                    },
                    {
                        deny: 'VIEW_CHANNEL',
                        id: guild.id
                    },
                    {
                        allow: 'VIEW_CHANNEL',
                        id: '625907626303160354'
                    }
                ]
            }).then(ch => {
                userTickets.set(user.id, ch.id); // Once ticket is created, set the user's id as a key mapping to the channel id.
                let embed = new discord.RichEmbed();
                embed.setTitle('Ticket Support');
                embed.setDescription('Please briefly explain your problem here and a staff member will get back to you shortly.');
                embed.setColor('#40BCD8');
                ch.send(embed) // Send a message to user.
            }).catch(err => console.log(err));
        }
    }
    else if(reaction.emoji.name === 'checkreact') {
        // If emoji is checkreact, they are trying to close the ticket.
        if(userTickets.has(user.id)) {
            if(reaction.message.channel.id === userTickets.get(user.id)) {
                let embed = new discord.RichEmbed();
                embed.setDescription("Ticket will be closed in 5 seconds.")
                reaction.message.channel.send(embed);
                setTimeout(() => {
                    reaction.message.channel.delete('closing ticket')
                    .then(channel => {
                        console.log("Deleted " + channel.name);
                    })
                    .catch(err => console.log(err));
                }, 5000);
            }
        }
        // This case is really for handling tickets that were not closed by the bot due to the bot possibly crashing.
        // In order for this to actually work, the user needs to have a ticket opened already.
        else if(reaction.message.guild.channels.some(channel => channel.name.toLowerCase() === user.username + 's-ticket')) {
            let embed = new discord.RichEmbed();
            embed.setDescription("Ticket will be closed in 5 seconds.");
            reaction.message.channel.send(embed);
            setTimeout(() => {
                reaction.message.guild.channels.forEach(channel => {
                    if(channel.name.toLowerCase() === user.username + 's-ticket') {
                        channel.delete().then(ch => console.log('Deleted Channel ' + ch.id))
                    }
                });
            }, 5000);
        }
    }
});