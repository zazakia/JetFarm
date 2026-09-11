-- Phase 1: Cooperative Membership Schema Updates

-- Add cooperative membership fields to app_borrowers
ALTER TABLE app_borrowers 
ADD COLUMN membership_number TEXT,
ADD COLUMN tin_number TEXT,
ADD COLUMN membership_type TEXT,
ADD COLUMN bod_resolution_number TEXT,
ADD COLUMN date_accepted BIGINT,
ADD COLUMN pmes_completed BOOLEAN,
ADD COLUMN pmes_date BIGINT,
ADD COLUMN birthplace TEXT,
ADD COLUMN religion TEXT,
ADD COLUMN education_level TEXT,
ADD COLUMN employer TEXT,
ADD COLUMN salary NUMERIC,
ADD COLUMN other_income_source TEXT,
ADD COLUMN nearest_relative TEXT,
ADD COLUMN number_of_dependents INTEGER,
ADD COLUMN spouse_surname TEXT,
ADD COLUMN spouse_first_name TEXT,
ADD COLUMN spouse_middle_name TEXT,
ADD COLUMN spouse_name_extension TEXT,
ADD COLUMN spouse_date_of_birth BIGINT,
ADD COLUMN spouse_birthplace TEXT,
ADD COLUMN spouse_occupation TEXT,
ADD COLUMN spouse_phone TEXT,
ADD COLUMN termination_date BIGINT,
ADD COLUMN termination_resolution TEXT,
ADD COLUMN barangay TEXT,
ADD COLUMN city_municipality TEXT,
ADD COLUMN province TEXT,
ADD COLUMN zip_code TEXT;

CREATE INDEX idx_app_borrowers_membership_number ON app_borrowers(membership_number);

-- Create app_dependents table
CREATE TABLE app_dependents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID REFERENCES app_borrowers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    age INTEGER,
    relationship TEXT,
    date_of_birth BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    deleted_at BIGINT
);
CREATE INDEX idx_app_dependents_member_id ON app_dependents(member_id);

-- Create app_children table
CREATE TABLE app_children (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID REFERENCES app_borrowers(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    date_of_birth BIGINT,
    age INTEGER,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    deleted_at BIGINT
);
CREATE INDEX idx_app_children_member_id ON app_children(member_id);

-- Create app_share_capital_transactions table
CREATE TABLE app_share_capital_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID REFERENCES app_borrowers(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL,
    share_type TEXT,
    number_of_shares INTEGER,
    par_value NUMERIC,
    amount NUMERIC NOT NULL,
    running_balance_shares INTEGER,
    running_balance_amount NUMERIC,
    reference_number TEXT,
    date BIGINT NOT NULL,
    notes TEXT,
    recorded_by TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    deleted_at BIGINT
);
CREATE INDEX idx_app_share_capital_transactions_member_id ON app_share_capital_transactions(member_id);

-- Create app_committees table
CREATE TABLE app_committees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT,
    is_active BOOLEAN,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    deleted_at BIGINT
);

-- Create app_committee_members table
CREATE TABLE app_committee_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    committee_id UUID REFERENCES app_committees(id) ON DELETE CASCADE,
    member_id UUID REFERENCES app_borrowers(id) ON DELETE CASCADE,
    position TEXT,
    term_start BIGINT,
    term_end BIGINT,
    is_active BOOLEAN,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    deleted_at BIGINT
);
CREATE INDEX idx_app_committee_members_committee_id ON app_committee_members(committee_id);
CREATE INDEX idx_app_committee_members_member_id ON app_committee_members(member_id);

-- Create app_board_resolutions table
CREATE TABLE app_board_resolutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resolution_number TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    resolution_date BIGINT NOT NULL,
    type TEXT,
    status TEXT,
    approved_by TEXT,
    reference_entity_type TEXT,
    reference_entity_id TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    deleted_at BIGINT
);
CREATE INDEX idx_app_board_resolutions_resolution_number ON app_board_resolutions(resolution_number);

-- Create app_meeting_attendance table
CREATE TABLE app_meeting_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID REFERENCES app_borrowers(id) ON DELETE CASCADE,
    meeting_type TEXT NOT NULL,
    meeting_date BIGINT NOT NULL,
    is_present BOOLEAN,
    notes TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    deleted_at BIGINT
);
CREATE INDEX idx_app_meeting_attendance_member_id ON app_meeting_attendance(member_id);

-- Add RLS Policies for new tables (basic authenticated access for now, similar to other tables)
ALTER TABLE app_dependents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read app_dependents" ON app_dependents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert app_dependents" ON app_dependents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update app_dependents" ON app_dependents FOR UPDATE TO authenticated USING (true);

ALTER TABLE app_children ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read app_children" ON app_children FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert app_children" ON app_children FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update app_children" ON app_children FOR UPDATE TO authenticated USING (true);

ALTER TABLE app_share_capital_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read app_share_capital_transactions" ON app_share_capital_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert app_share_capital_transactions" ON app_share_capital_transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update app_share_capital_transactions" ON app_share_capital_transactions FOR UPDATE TO authenticated USING (true);

ALTER TABLE app_committees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read app_committees" ON app_committees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert app_committees" ON app_committees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update app_committees" ON app_committees FOR UPDATE TO authenticated USING (true);

ALTER TABLE app_committee_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read app_committee_members" ON app_committee_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert app_committee_members" ON app_committee_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update app_committee_members" ON app_committee_members FOR UPDATE TO authenticated USING (true);

ALTER TABLE app_board_resolutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read app_board_resolutions" ON app_board_resolutions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert app_board_resolutions" ON app_board_resolutions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update app_board_resolutions" ON app_board_resolutions FOR UPDATE TO authenticated USING (true);

ALTER TABLE app_meeting_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read app_meeting_attendance" ON app_meeting_attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert app_meeting_attendance" ON app_meeting_attendance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update app_meeting_attendance" ON app_meeting_attendance FOR UPDATE TO authenticated USING (true);
