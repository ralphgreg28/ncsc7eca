-- Add new fields to citizens table
ALTER TABLE citizens 
ADD COLUMN specimen TEXT CHECK (specimen IN ('signature', 'thumbmark')),
ADD COLUMN disability TEXT CHECK (disability IN ('yes', 'no')),
ADD COLUMN indigenous_people TEXT CHECK (indigenous_people IN ('yes', 'no'));

-- Add comments for documentation
COMMENT ON COLUMN citizens.specimen IS 'Type of specimen provided: signature or thumbmark';
COMMENT ON COLUMN citizens.disability IS 'Whether the citizen has a disability: yes or no';
COMMENT ON COLUMN citizens.indigenous_people IS 'Whether the citizen belongs to indigenous people: yes or no';
