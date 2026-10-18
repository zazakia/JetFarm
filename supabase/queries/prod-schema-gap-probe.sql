-- read-only production schema probe
select current_database();
select count(*) as dbs from pg_database where datallowconn;
select datname from pg_database where datallowconn order by 1;
select table_name, column_name
from information_schema.columns
where table_schema='public'
  and (
    (table_name='app_borrowers' and column_name in ('barangay','membership_number','member_id','middle_name','deceased'))
    or (table_name='app_loans' and column_name='savings_amount')
    or (table_name='user_profiles' and column_name in ('branch_id','area_id'))
    or (table_name='app_payments' and column_name='payment_type')
    or (table_name='app_cash_transactions' and column_name in ('is_petty_cash','pos_session_id','branch_id'))
    or (table_name='app_bank_transactions' and column_name in ('is_cleared','cleared_at'))
  )
order by table_name, column_name;
select table_name from information_schema.tables where table_schema='public'
  and table_name in ('app_dependents','app_children','app_share_capital_transactions','agri_parcels','agri_parcel_blocks','agri_block_assignments','agri_block_progress','suppliers');
select count(*) as jetfarm_rows from deploy_schema_migrations where app_name='jetfarm';
select version, applied_at from deploy_schema_migrations where app_name='jetfarm' and version like '2026%' order by version desc limit 8;
