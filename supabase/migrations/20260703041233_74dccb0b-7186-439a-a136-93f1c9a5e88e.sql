-- Preset esercizi catalogo per volleyball strength training

-- Solo INSERT con ON CONFLICT DO NOTHING per sicurezza

INSERT INTO public.esercizi_catalogo (name, category, muscle_group, default_unit, is_public, created_by)

VALUES

  -- FORZA Lower Body

  ('Squat', 'forza', 'Quadricipiti, Glutei', 'kg', true, null),

  ('Squat frontale', 'forza', 'Quadricipiti, Core', 'kg', true, null),

  ('Stacco da terra', 'forza', 'Posterior chain', 'kg', true, null),

  ('Affondi con bilanciere', 'forza', 'Quadricipiti, Glutei', 'kg', true, null),

  ('Leg press', 'forza', 'Quadricipiti, Glutei', 'kg', true, null),

  ('Romanian deadlift', 'forza', 'Femorali, Glutei', 'kg', true, null),

  ('Hip thrust', 'forza', 'Glutei', 'kg', true, null),

  ('Leg curl', 'forza', 'Femorali', 'kg', true, null),

  ('Leg extension', 'forza', 'Quadricipiti', 'kg', true, null),

  ('Calf raise', 'forza', 'Polpacci', 'kg', true, null),

  ('Step up con manubri', 'forza', 'Quadricipiti, Glutei', 'kg', true, null),

  ('Bulgarian split squat', 'forza', 'Quadricipiti, Glutei', 'kg', true, null),

  -- FORZA Upper Body

  ('Panca piana', 'forza', 'Pettorali, Tricipiti', 'kg', true, null),

  ('Panca inclinata', 'forza', 'Pettorali superiori', 'kg', true, null),

  ('Military press', 'forza', 'Deltoidi, Tricipiti', 'kg', true, null),

  ('Lento avanti con manubri', 'forza', 'Deltoidi', 'kg', true, null),

  ('Trazioni', 'forza', 'Dorsali, Bicipiti', 'BW', true, null),

  ('Lat machine', 'forza', 'Dorsali', 'kg', true, null),

  ('Rematore con bilanciere', 'forza', 'Dorsali, Bicipiti', 'kg', true, null),

  ('Rematore con manubrio', 'forza', 'Dorsali', 'kg', true, null),

  ('Face pull', 'forza', 'Deltoidi posteriori, Trapezi', 'kg', true, null),

  ('Alzate laterali', 'forza', 'Deltoidi medi', 'kg', true, null),

  ('Alzate frontali', 'forza', 'Deltoidi anteriori', 'kg', true, null),

  ('Curl con bilanciere', 'forza', 'Bicipiti', 'kg', true, null),

  ('Tricipiti ai cavi', 'forza', 'Tricipiti', 'kg', true, null),

  -- POTENZA

  ('Salto verticale', 'potenza', 'Quadricipiti, Glutei', 'BW', true, null),

  ('Squat jump', 'potenza', 'Quadricipiti, Glutei', 'BW', true, null),

  ('Box jump', 'potenza', 'Quadricipiti, Glutei', 'BW', true, null),

  ('Depth jump', 'potenza', 'Quadricipiti, Glutei', 'BW', true, null),

  ('Broad jump', 'potenza', 'Quadricipiti, Glutei', 'BW', true, null),

  ('Power clean', 'potenza', 'Full body', 'kg', true, null),

  ('Hang clean', 'potenza', 'Full body', 'kg', true, null),

  ('Push press', 'potenza', 'Deltoidi, Gambe', 'kg', true, null),

  ('Kettlebell swing', 'potenza', 'Glutei, Femorali', 'kg', true, null),

  ('Medicine ball slam', 'potenza', 'Core, Spalle', 'kg', true, null),

  ('Medicine ball chest pass', 'potenza', 'Pettorali, Tricipiti', 'kg', true, null),

  ('Sprint 10m', 'potenza', 'Full body', 'sec', true, null),

  ('Sprint 20m', 'potenza', 'Full body', 'sec', true, null),

  -- CORE

  ('Plank', 'core', 'Core', 'sec', true, null),

  ('Side plank', 'core', 'Core laterale', 'sec', true, null),

  ('Crunch', 'core', 'Addominali', 'BW', true, null),

  ('Russian twist', 'core', 'Obliqui', 'BW', true, null),

  ('Dead bug', 'core', 'Core', 'BW', true, null),

  ('Pallof press', 'core', 'Core anti-rotazione', 'kg', true, null),

  ('Rollout con ruota', 'core', 'Core', 'BW', true, null),

  ('Hanging leg raise', 'core', 'Addominali inferiori', 'BW', true, null),

  ('Bird dog', 'core', 'Core, Lombari', 'BW', true, null),

  ('Hyperextension', 'core', 'Lombari, Glutei', 'BW', true, null),

  -- PLIOMETRIA specifica pallavolo

  ('Salto con approccio', 'pliometria', 'Full body', 'BW', true, null),

  ('Salto da fermo', 'pliometria', 'Quadricipiti, Glutei', 'BW', true, null),

  ('Salto su una gamba', 'pliometria', 'Quadricipiti, Glutei', 'BW', true, null),

  ('Balzi laterali', 'pliometria', 'Quadricipiti, Abduttori', 'BW', true, null),

  ('Skipping', 'pliometria', 'Full body', 'BW', true, null),

  ('Corsa calciata', 'pliometria', 'Femorali', 'BW', true, null),

  -- MOBILITA e RECUPERO

  ('Hip flexor stretch', 'mobilita', 'Flessori anca', 'sec', true, null),

  ('Thoracic rotation', 'mobilita', 'Torace', 'BW', true, null),

  ('Ankle mobility', 'mobilita', 'Caviglia', 'BW', true, null),

  ('Band pull apart', 'mobilita', 'Deltoidi posteriori', 'BW', true, null),

  ('Foam roller quadricipiti', 'recupero', 'Quadricipiti', 'sec', true, null),

  ('Foam roller dorsali', 'recupero', 'Dorsali', 'sec', true, null),

  -- RISCALDAMENTO

  ('Riscaldamento generale', 'riscaldamento', 'Full body', 'BW', true, null),

  ('Attivazione glutei con band', 'riscaldamento', 'Glutei', 'BW', true, null),

  ('Attivazione spalle', 'riscaldamento', 'Spalle, Rotatori', 'BW', true, null)

ON CONFLICT (name) DO NOTHING;