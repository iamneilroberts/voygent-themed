-- Migration 015: Add 12 Creative Trip Templates
-- Feature: 009-build-12-creative
-- Purpose: Expand template library with diverse travel interests

-- 1. Wellness & Spiritual
INSERT INTO trip_templates (
  id, name, description, icon,
  intake_prompt, options_prompt,
  research_synthesis_prompt, research_query_template,
  required_fields, optional_fields, example_inputs,
  tags, is_featured, display_order, is_active
) VALUES (
  'wellness',
  'Wellness & Spiritual',
  'Yoga retreats, meditation centers, and spiritual journeys',
  '🧘',
  'Extract wellness preferences: destination, retreat type (yoga/meditation/holistic), duration, budget level, and any specific practices or traditions of interest.',
  'Generate 2-4 wellness trip options featuring: yoga retreats, meditation centers, spa experiences, holistic healing, spiritual sites. Include accommodation at wellness resorts, daily schedules, practitioner credentials, and mindfulness activities.',
  'Based on these web search results about {destination} wellness and retreat options, identify top-rated yoga retreats, meditation centers, and holistic healing venues. Focus on: authentic experiences, qualified instructors, peaceful settings, and traveler reviews. Web search results: {search_results}. Create a 2-3 paragraph summary (150-200 words) listing specific retreat centers, meditation venues, spa facilities, and wellness activities available in {destination}.',
  '{destination} yoga retreat meditation center wellness spa holistic healing travel',
  '["destination", "duration"]',
  '["retreat_type", "budget", "practices", "adults"]',
  '{"destination": "Bali", "duration": 7, "retreat_type": "yoga", "adults": 2}',
  '["wellness", "spiritual", "yoga", "meditation", "retreat"]',
  0, 20, 1
);

-- 2. Architecture
INSERT INTO trip_templates (
  id, name, description, icon,
  intake_prompt, options_prompt,
  research_synthesis_prompt, research_query_template,
  required_fields, optional_fields, example_inputs,
  tags, is_featured, display_order, is_active
) VALUES (
  'architecture',
  'Architecture & Design',
  'Iconic buildings, UNESCO sites, and architectural tours',
  '🏛️',
  'Extract architecture interests: destination/architect/style, architectural periods of interest, tour preferences (guided/self-guided), duration, and specific buildings or styles.',
  'Generate 2-4 architecture-focused trip options featuring: iconic buildings, UNESCO World Heritage sites, architect-specific tours (e.g., Gaudí, Wright, Gehry), architectural museums, and walking tours of historic districts. Include expert guides, photo opportunities, and access information.',
  'Based on these web search results about {destination} architecture, identify the most significant buildings, architects, and architectural tours available. Focus on: UNESCO sites, famous architects'' works, architectural styles, guided tour options, and visitor access. Web search results: {search_results}. Create a 2-3 paragraph summary (150-200 words) listing specific buildings, architects, architectural periods, and tour recommendations for {destination}.',
  '{destination} architecture buildings UNESCO sites {architect} tours travel guide',
  '["destination"]',
  '["architect", "style", "duration", "tour_type", "adults"]',
  '{"destination": "Barcelona", "architect": "Gaudí", "duration": 5, "adults": 2}',
  '["architecture", "design", "buildings", "unesco", "tours"]',
  0, 30, 1
);

-- 3. Music
INSERT INTO trip_templates (
  id, name, description, icon,
  intake_prompt, options_prompt,
  research_synthesis_prompt, research_query_template,
  required_fields, optional_fields, example_inputs,
  tags, is_featured, display_order, is_active
) VALUES (
  'music',
  'Music & Festivals',
  'Jazz clubs, classical venues, and music history tours',
  '🎵',
  'Extract music preferences: genre (jazz/classical/rock/folk), destination, specific artists or festivals, venue types (clubs/concert halls/festivals), duration.',
  'Generate 2-4 music-themed trip options featuring: live music venues, music festivals, music history museums, recording studios, legendary performance halls. Include concert/festival tickets, backstage access where available, and music history tours.',
  'Based on these web search results about {genre} music in {destination}, identify top venues, festivals, and music history sites. Focus on: live performance venues, music festivals, historic sites related to famous musicians, and unique music experiences. Web search results: {search_results}. Create a 2-3 paragraph summary (150-200 words) listing specific clubs, concert halls, festivals, and music landmarks in {destination}.',
  '{genre} music {destination} festivals venues concerts tours travel guide',
  '["destination", "genre"]',
  '["artists", "festivals", "duration", "adults"]',
  '{"destination": "New Orleans", "genre": "jazz", "duration": 4, "adults": 2}',
  '["music", "festivals", "concerts", "venues", "entertainment"]',
  0, 40, 1
);

-- 4. Wildlife Photography
INSERT INTO trip_templates (
  id, name, description, icon,
  intake_prompt, options_prompt,
  research_synthesis_prompt, research_query_template,
  required_fields, optional_fields, example_inputs,
  tags, is_featured, display_order, is_active
) VALUES (
  'wildlife',
  'Wildlife Photography',
  'Safari adventures and rare species encounters',
  '📸🦁',
  'Extract wildlife photography needs: destination/ecosystem, target species, photography skill level, equipment available, best season, duration.',
  'Generate 2-4 wildlife photography trip options featuring: photography-friendly lodges, golden hour game drives, rare species sightings, expert photography guides, optimal viewing locations. Include camera equipment recommendations, lighting conditions, and wildlife behavior tips.',
  'Based on these web search results about wildlife photography in {destination}, identify the best lodges, game reserves, and photography opportunities. Focus on: photo-friendly accommodations, golden hour access, rare species locations, expert guides, and seasonal timing. Web search results: {search_results}. Create a 2-3 paragraph summary (150-200 words) listing specific lodges, reserves, target species, and photography tips for {destination}.',
  '{destination} wildlife photography safari lodges {species} golden hour tours',
  '["destination", "species"]',
  '["skill_level", "equipment", "season", "duration", "adults"]',
  '{"destination": "Kenya", "species": "big cats", "duration": 8, "adults": 2}',
  '["wildlife", "photography", "safari", "nature", "adventure"]',
  0, 50, 1
);

-- 5. Festivals
INSERT INTO trip_templates (
  id, name, description, icon,
  intake_prompt, options_prompt,
  research_synthesis_prompt, research_query_template,
  required_fields, optional_fields, example_inputs,
  tags, is_featured, display_order, is_active
) VALUES (
  'festivals',
  'Cultural Festivals',
  'Carnivals, celebrations, and seasonal events',
  '🎉',
  'Extract festival interests: festival type (cultural/seasonal/religious), destination, specific events, travel dates, participation level (observer/participant).',
  'Generate 2-4 festival-focused trip options featuring: major cultural celebrations, carnival experiences, seasonal festivals, local traditions, parade viewing locations. Include festival schedules, ticket information, costume recommendations, and cultural context.',
  'Based on these web search results about festivals in {destination}, identify major cultural celebrations, timing, and visitor information. Focus on: festival dates, ticket availability, best viewing locations, cultural significance, and practical tips. Web search results: {search_results}. Create a 2-3 paragraph summary (150-200 words) listing specific festivals, dates, locations, and participation tips for {destination}.',
  '{destination} cultural festivals carnivals celebrations events travel dates tickets',
  '["destination", "festival_type"]',
  '["dates", "participation_level", "duration", "adults"]',
  '{"destination": "India", "festival_type": "Holi", "duration": 5, "adults": 2}',
  '["festivals", "cultural", "celebrations", "events", "traditions"]',
  0, 60, 1
);

-- 6. Sports
INSERT INTO trip_templates (
  id, name, description, icon,
  intake_prompt, options_prompt,
  research_synthesis_prompt, research_query_template,
  required_fields, optional_fields, example_inputs,
  tags, is_featured, display_order, is_active
) VALUES (
  'sports',
  'Sports Events',
  'Major sporting events and legendary venues',
  '⚽',
  'Extract sports preferences: sport type, specific event (World Cup/Olympics/F1), destination, team/athlete preferences, event dates.',
  'Generate 2-4 sports-focused trip options featuring: major sporting events, stadium tours, fan experiences, legendary sports venues, meet-and-greet opportunities. Include ticket information, hospitality packages, and pre/post-event activities.',
  'Based on these web search results about {sport} events in {destination}, identify major competitions, venues, and fan experiences. Focus on: event schedules, ticket availability, stadium tours, legendary venues, and fan zones. Web search results: {search_results}. Create a 2-3 paragraph summary (150-200 words) listing specific events, venues, dates, and ticketing information for {sport} in {destination}.',
  '{sport} {destination} events tickets stadium tours fan experiences travel',
  '["destination", "sport"]',
  '["event", "dates", "team", "duration", "adults"]',
  '{"destination": "Monaco", "sport": "Formula 1", "event": "Monaco Grand Prix", "adults": 2}',
  '["sports", "events", "stadiums", "competitions", "fans"]',
  0, 70, 1
);

-- 7. Literary
INSERT INTO trip_templates (
  id, name, description, icon,
  intake_prompt, options_prompt,
  research_synthesis_prompt, research_query_template,
  required_fields, optional_fields, example_inputs,
  tags, is_featured, display_order, is_active
) VALUES (
  'literary',
  'Literary Travel',
  'Follow in the footsteps of famous authors',
  '📚',
  'Extract literary interests: author/book/literary period, destination, specific sites (homes/museums/inspiration locations), tour preferences.',
  'Generate 2-4 literary-themed trip options featuring: author birthplaces, literary museums, inspiration locations, bookshops, writer''s haunts, literary festivals. Include guided literary walks, book-themed accommodations, and reading recommendations.',
  'Based on these web search results about {author} and literary sites in {destination}, identify key locations, museums, and literary landmarks. Focus on: author homes, inspiration sites, literary museums, book-themed tours, and literary festivals. Web search results: {search_results}. Create a 2-3 paragraph summary (150-200 words) listing specific literary sites, author connections, and book-themed experiences in {destination}.',
  '{author} literary sites {destination} museums bookshops writer tours travel',
  '["destination", "author"]',
  '["book", "period", "duration", "adults"]',
  '{"destination": "England", "author": "Shakespeare", "duration": 5, "adults": 2}',
  '["literary", "authors", "books", "museums", "culture"]',
  0, 80, 1
);

-- 8. Wine & Beer
INSERT INTO trip_templates (
  id, name, description, icon,
  intake_prompt, options_prompt,
  research_synthesis_prompt, research_query_template,
  required_fields, optional_fields, example_inputs,
  tags, is_featured, display_order, is_active
) VALUES (
  'wine',
  'Wine & Beer Tours',
  'Vineyard tours, breweries, and tasting experiences',
  '🍷',
  'Extract beverage preferences: wine/beer/spirits, region, specific varietals or styles, tasting experience level, duration.',
  'Generate 2-4 wine/beer-focused trip options featuring: vineyard tours, winery tastings, brewery visits, cellar experiences, sommelier-guided tours. Include accommodation at wine estates, tasting schedules, food pairings, and purchase opportunities.',
  'Based on these web search results about {beverage_type} in {destination}, identify top wineries, breweries, and tasting experiences. Focus on: renowned producers, tasting rooms, tours available, accommodation at estates, and seasonal timing. Web search results: {search_results}. Create a 2-3 paragraph summary (150-200 words) listing specific wineries, breweries, tasting experiences, and wine/beer routes in {destination}.',
  '{beverage_type} {destination} wineries breweries tastings tours travel guide',
  '["destination", "beverage_type"]',
  '["varietals", "experience_level", "duration", "adults"]',
  '{"destination": "Tuscany", "beverage_type": "wine", "duration": 6, "adults": 2}',
  '["wine", "beer", "tastings", "wineries", "breweries", "culinary"]',
  0, 90, 1
);

-- 9. Art
INSERT INTO trip_templates (
  id, name, description, icon,
  intake_prompt, options_prompt,
  research_synthesis_prompt, research_query_template,
  required_fields, optional_fields, example_inputs,
  tags, is_featured, display_order, is_active
) VALUES (
  'art',
  'Art & Museums',
  'Gallery tours, museums, and artist studios',
  '🎨',
  'Extract art preferences: art period/movement, specific artists, destination, museum types (contemporary/classical/modern), gallery preferences.',
  'Generate 2-4 art-focused trip options featuring: world-class museums, contemporary galleries, artist studios, public art installations, art districts. Include guided museum tours, curator talks, private viewings, and art workshop experiences.',
  'Based on these web search results about art and museums in {destination}, identify major galleries, museums, and art experiences. Focus on: renowned collections, contemporary art spaces, public installations, artist studios, and special exhibitions. Web search results: {search_results}. Create a 2-3 paragraph summary (150-200 words) listing specific museums, galleries, art movements represented, and must-see works in {destination}.',
  '{destination} art museums galleries {artist} exhibitions contemporary art travel',
  '["destination"]',
  '["art_period", "artists", "museum_type", "duration", "adults"]',
  '{"destination": "Paris", "art_period": "Impressionism", "duration": 4, "adults": 2}',
  '["art", "museums", "galleries", "culture", "exhibitions"]',
  0, 100, 1
);

-- 10. Romance/Honeymoon
INSERT INTO trip_templates (
  id, name, description, icon,
  intake_prompt, options_prompt,
  research_synthesis_prompt, research_query_template,
  required_fields, optional_fields, example_inputs,
  tags, is_featured, display_order, is_active
) VALUES (
  'romance',
  'Romance & Honeymoon',
  'Couples activities and intimate experiences',
  '💑',
  'Extract romance preferences: destination, occasion (honeymoon/anniversary/romantic getaway), luxury level, activity preferences (relaxing/adventurous), duration.',
  'Generate 2-4 romantic trip options featuring: couples resorts, private dining, sunset experiences, spa for two, romantic activities (hot air balloon/private cruise). Include honeymoon suites, romantic restaurants, and intimate venues.',
  'Based on these web search results about romantic experiences in {destination}, identify couples resorts, romantic restaurants, and intimate activities. Focus on: honeymoon accommodations, couples spa, private dining, sunset spots, and romantic excursions. Web search results: {search_results}. Create a 2-3 paragraph summary (150-200 words) listing specific romantic venues, couples activities, and intimate experiences in {destination}.',
  '{destination} romantic honeymoon couples resorts intimate dining sunset travel',
  '["destination"]',
  '["occasion", "luxury", "activity_level", "duration"]',
  '{"destination": "Maldives", "occasion": "honeymoon", "luxury": "high", "duration": 7}',
  '["romance", "honeymoon", "couples", "intimate", "luxury"]',
  1, 10, 1
);

-- 11. Sustainability
INSERT INTO trip_templates (
  id, name, description, icon,
  intake_prompt, options_prompt,
  research_synthesis_prompt, research_query_template,
  required_fields, optional_fields, example_inputs,
  tags, is_featured, display_order, is_active
) VALUES (
  'sustainability',
  'Eco & Sustainable Travel',
  'Eco-tourism, conservation, and responsible travel',
  '🌍',
  'Extract sustainability preferences: destination, eco-interests (conservation/renewable energy/permaculture), accommodation preferences (eco-lodges/off-grid), activity types (volunteer/educational).',
  'Generate 2-4 sustainable travel options featuring: eco-lodges, conservation projects, sustainable tours, carbon-neutral activities, community-based tourism. Include environmental certifications, responsible travel practices, and positive impact opportunities.',
  'Based on these web search results about eco-tourism in {destination}, identify certified eco-lodges, conservation projects, and sustainable activities. Focus on: environmental certifications, community tourism, conservation volunteering, carbon-neutral options. Web search results: {search_results}. Create a 2-3 paragraph summary (150-200 words) listing specific eco-lodges, conservation sites, and sustainable travel options in {destination}.',
  '{destination} eco-tourism sustainable travel conservation eco-lodges responsible tourism',
  '["destination"]',
  '["eco_interests", "accommodation", "activities", "duration", "adults"]',
  '{"destination": "Costa Rica", "eco_interests": "conservation", "duration": 8, "adults": 2}',
  '["sustainability", "eco-tourism", "conservation", "responsible", "green"]',
  0, 110, 1
);

-- 12. Photography (General)
INSERT INTO trip_templates (
  id, name, description, icon,
  intake_prompt, options_prompt,
  research_synthesis_prompt, research_query_template,
  required_fields, optional_fields, example_inputs,
  tags, is_featured, display_order, is_active
) VALUES (
  'photography',
  'Photography Tours',
  'Landscape, street, and travel photography',
  '📷',
  'Extract photography preferences: destination, photography style (landscape/street/portrait/architecture), equipment level, golden hour access, duration.',
  'Generate 2-4 photography-focused trip options featuring: iconic photo locations, golden hour access, local photography guides, workshops, street photography opportunities. Include sunrise/sunset timing, weather considerations, equipment recommendations, and photo permit information.',
  'Based on these web search results about photography in {destination}, identify the best photo locations, lighting conditions, and photography tours. Focus on: iconic viewpoints, golden hour spots, street photography districts, photo workshops, and seasonal considerations. Web search results: {search_results}. Create a 2-3 paragraph summary (150-200 words) listing specific photo locations, best times for shooting, and photography tour options in {destination}.',
  '{destination} photography tours landscape street golden hour photo spots travel',
  '["destination", "style"]',
  '["equipment", "skill_level", "duration", "adults"]',
  '{"destination": "Iceland", "style": "landscape", "duration": 6, "adults": 2}',
  '["photography", "tours", "landscape", "travel", "workshops"]',
  0, 120, 1
);
