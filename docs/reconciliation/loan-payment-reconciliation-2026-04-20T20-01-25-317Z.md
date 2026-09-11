# Loan and Payment Reconciliation Report

Generated: 2026-04-20T20:01:25.317Z

Mode: read-only SELECT report. No database rows or schema objects were changed.

Sample limit per detail section: 25

## Recommended Review Order

1. Renewals whose previous loan is not paid
2. Borrowers with multiple active loans
3. Overpaid loans
4. Paid loans with remaining balance
5. Schedule total/status mismatches
6. Payments missing schedule links
7. Potential savings overcredits


## Record Counts

| table_name | count |
| --- | --- |
| loans |570 |
| payment_schedules |22771 |
| payments |13177 |
| savings_transactions |52 |


## Summary Counts

| issue | count |
| --- | --- |
| active_status_fully_paid |0 |
| borrowers_with_multiple_active_loans |3 |
| orphan_payments |0 |
| orphan_schedules |0 |
| overpaid_loans |2 |
| paid_status_with_balance |272 |
| payments_without_schedule_id |6508 |
| potential_savings_overcredits |2 |
| renewals_old_loan_not_paid |0 |
| schedule_status_mismatches |266 |
| schedule_total_mismatches |7 |


## Schedule Total Mismatches

| id | loan_number | borrower_name | status | loan_total | schedule_total | difference | schedule_count |
| --- | --- | --- | --- | --- | --- | --- | --- |
| f5d3afbc-1132-4dd2-a7b5-fbfad3829848 |LN-20260420-181915-415719 |Carolina L. Misperos |active |19267.00 |38534.00 |19267.00 |46 |
| 083b4173-8e8d-4b66-b77c-77c478a740d2 | |Lorina Cagabhion Malayan |active |11360.00 |0.00 |-11360.00 |0 |
| b77bf664-9eca-4832-8441-6c89a8b8250a |LN-20260417-9567 |Genara A. Cantiga |active |6400.00 |12800.00 |6400.00 |80 |
| 738aeb65-02d2-451a-af15-f87ab116ac19 |LN-20260328-9164 |Fe B. Garbe |active |6400.00 |12600.00 |6200.00 |40 |
| 6ccc76bc-f80b-48aa-bdec-da351c1eccd7 |LN-20260328-4019 |Gleceria J. Teves |paid |6200.00 |0.00 |-6200.00 |0 |
| a4cae74f-2382-4fef-a85e-57dfe931818b |LN-20260328-8374 |Lorina Cagabhion Malayan |paid |6200.00 |0.00 |-6200.00 |0 |
| 46f28298-19fa-4ef7-bb53-aeb19a1a2019 |LN-20260328-5304 |Geraliz B. Bucao |active |31000.00 |31200.00 |200.00 |40 |


## Paid Loans With Remaining Balance

| id | loan_number | borrower_name | loan_total | paid | balance |
| --- | --- | --- | --- | --- | --- |
| dee78a62-7146-407b-b378-b3b8fd3d8692 |LN-20260328-1318 |Marilu B. Bande |12600.00 |2850.00 |9750.00 |
| a4cae74f-2382-4fef-a85e-57dfe931818b |LN-20260328-8374 |Lorina Cagabhion Malayan |6200.00 |0.00 |6200.00 |
| 6ccc76bc-f80b-48aa-bdec-da351c1eccd7 |LN-20260328-4019 |Gleceria J. Teves |6200.00 |1525.00 |4675.00 |
| a7b6c244-8242-4ddd-9558-e6b33cb1b57b |LN-20260328-5099 |Florenda N. Cimene |12400.00 |9277.00 |3123.00 |
| 090aca9f-da08-45ed-aaa2-487bd52dcf7a |LN-20260328-4864 |Alfredo P. Cayanong |12400.00 |9300.00 |3100.00 |
| f907485b-0f75-44e2-aadc-1be0810aaf03 |LN-20260328-6086 |Rosanna T. Germano |18600.00 |15520.00 |3080.00 |
| 4b3c41f2-c17c-4b75-9cb7-4af0e5d221e7 |LN-20260328-7761 |Stephanie G. Cuan |17360.00 |14528.00 |2832.00 |
| 69218e39-6fc7-4210-9e3b-e8b0d19ad697 |LN-20260328-0304 |Rosanna T. Germano |12400.00 |9587.00 |2813.00 |
| 0f7e3b00-074d-48df-9e4f-4506d8b848fd |LN-20260328-5125 |Socorro H. Cuan |8680.00 |6076.00 |2604.00 |
| bf049bfb-0f16-494a-a9e3-f2dd08ae49de |LN-20260328-1606 |Carolina L. Misperos |12400.00 |9800.00 |2600.00 |
| ae1d2448-5abc-46ee-9332-0fe78ef8a04d |LN-20260328-0556 |Stephanie G. Cuan |14880.00 |12459.00 |2421.00 |
| ab21ac86-69ee-45b5-8ee8-d8ab24152ac3 |LN-20260328-4223 |Florenda N. Cimene |14880.00 |12541.00 |2339.00 |
| b713dfc6-27be-4dfb-9159-5049e0becfda |LN-20260328-6767 |Maria Lourdes D. Patricio |24800.00 |22510.00 |2290.00 |
| ade2a4f6-18b0-4648-92c4-861638088a5e |LN-20260328-7447 |Socorro H. Cuan |12400.00 |10180.00 |2220.00 |
| 9675ae33-9f75-40a1-bd60-476cbc278786 |LN-20260328-6643 |Ma. Liza Librea |9920.00 |7702.00 |2218.00 |
| ebb5dad0-c023-47e6-9ccf-86e9014de59f |LN-20260328-8399 |Leonora P. Trigosa |9920.00 |7722.00 |2198.00 |
| 513c0aad-9a31-4168-86f0-be89f18e619c |LN-20260328-1311 |Emma J. Dela Pena |8680.00 |6519.00 |2161.00 |
| 78df4ee6-4b95-4bfe-b943-749f394d8c4c |LN-20260328-6683 |Emma J. Dela Pena |12400.00 |10330.00 |2070.00 |
| 561665ad-a519-45e4-8053-9dad62fb1686 |LN-20260328-2414 |Maria Camila Lahoylahoy |6200.00 |4185.00 |2015.00 |
| 2f38b209-aeb9-4c4c-b838-96ef3d7d4ed9 |LN-20260328-9231 |Arcelene B. Castro |6200.00 |4185.00 |2015.00 |
| 9f486553-b722-4456-ab00-897c0c734518 |LN-20260328-3785 |Maria Lourdes D. Patricio |17360.00 |15360.00 |2000.00 |
| d4945291-7343-450d-b199-892e8fddf8ac |LN-20260328-5515 |Cristita Cagabhion |8680.00 |6684.00 |1996.00 |
| 29e35ee5-d94c-476d-9557-d16019421b88 |LN-20260328-0729 |Irma C. Marquez |8680.00 |6723.00 |1957.00 |
| 1ea90e46-dd92-4e38-8b46-82c189dbe77d |LN-20260328-9533 |Lucita C. Cagabhion |11160.00 |9220.00 |1940.00 |
| b09984c1-5f8b-4188-a3bb-8925e2e3e77c |LN-20260328-7217 |Florenda N. Cimene |12400.00 |10490.00 |1910.00 |


## Overpaid Loans

| id | loan_number | borrower_name | status | loan_total | paid | overpaid |
| --- | --- | --- | --- | --- | --- | --- |
| 89a5ae64-8ed0-4775-a63a-155e40c018ee |LN-20260417-1482 |Carolina L. Misperos |paid |15080.00 |45240.00 |30160.00 |
| 6d822d22-123a-4e11-a24e-bcd4847e0fe3 |LN-20260328-2360 |Jean M. Sanchez |paid |6200.00 |6355.00 |155.00 |


## Borrowers With Multiple Active Loans

| borrower_id | borrower_name | active_count | active_loans |
| --- | --- | --- | --- |
| 94d708bc-4cae-4a1b-950d-b5d56ca6b61d |Dennis Lunzaga |4 |LN-20260328-8887, LN-20260417-130954-121024, LN-20260418-002350-341883, LN-20260420-201048-543779 |
| 80b57c8e-fb27-4ea4-a303-473f3412c3c6 |Lorina Cagabhion Malayan |3 |LN-20260328-0362, LN-20260328-2478, 083b4173-8e8d-4b66-b77c-77c478a740d2 |
| 8d53e40e-9ff6-4931-8777-c741683292df |Genara A. Cantiga |2 |LN-20260328-6059, LN-20260417-9567 |


## Renewals Whose Previous Loan Is Not Paid

_No rows._


## Schedule Status Mismatches

| id | loan_number | borrower_name | due_date | scheduled_amount | total_paid | status | expected_status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7a57c10e-9bc7-41c4-ba06-24b209671c4e |LN-20260328-8536 |Myla P. Soria |2025-10-29T16:00:00.000Z |155.00 |4630.00 |pending |late |
| 958e83bd-d1d1-40b3-8013-a74a10eced68 |LN-20260328-8536 |Myla P. Soria |2025-10-30T16:00:00.000Z |155.00 |4630.00 |pending |late |
| 8b8efbdc-ddb3-4a75-a66b-d1a1006c92ea |LN-20260328-8536 |Myla P. Soria |2025-10-31T16:00:00.000Z |155.00 |4630.00 |pending |late |
| d1d32186-1354-4695-83d6-bd9e5a174973 |LN-20260328-8536 |Myla P. Soria |2025-11-02T16:00:00.000Z |155.00 |4630.00 |pending |late |
| 80c6f5fb-3cfe-4551-93ea-f8bd39e95547 |LN-20260328-8536 |Myla P. Soria |2025-11-03T16:00:00.000Z |155.00 |4630.00 |pending |late |
| 2dabc39b-cedd-46ac-82b2-94457b827812 |LN-20260328-8536 |Myla P. Soria |2025-11-04T16:00:00.000Z |155.00 |4630.00 |pending |late |
| a8224a01-2951-48a2-a0e4-9a401b113ffd |LN-20260328-8536 |Myla P. Soria |2025-11-05T16:00:00.000Z |155.00 |4630.00 |pending |late |
| ca57438b-9ec7-498b-a28f-fcb8a9f81917 |LN-20260328-8536 |Myla P. Soria |2025-11-06T16:00:00.000Z |155.00 |4630.00 |pending |late |
| 98e6fd0f-da55-40c8-a053-996c0493e5ff |LN-20260328-8536 |Myla P. Soria |2025-11-07T16:00:00.000Z |155.00 |4630.00 |pending |late |
| 357722d7-5aa7-4b3d-b218-c510976a9bb3 |LN-20260328-8536 |Myla P. Soria |2025-11-09T16:00:00.000Z |155.00 |4630.00 |pending |late |
| e14f9335-fc04-486a-92b2-20cbce533314 |LN-20260328-0365 |Arcelene B. Castro |2025-11-23T16:00:00.000Z |310.00 |7760.00 |pending |late |
| 0d99f8f0-6922-4671-bb7e-2ab4398496c1 |LN-20260328-0365 |Arcelene B. Castro |2025-11-24T16:00:00.000Z |310.00 |7760.00 |pending |late |
| ae99a0ab-e12d-42ed-9c91-52f03ecd9264 |LN-20260328-0365 |Arcelene B. Castro |2025-11-25T16:00:00.000Z |310.00 |7760.00 |pending |late |
| dbff56cd-aebe-4ba6-8745-7bdd726c985e |LN-20260328-0365 |Arcelene B. Castro |2025-11-26T16:00:00.000Z |310.00 |7760.00 |pending |late |
| 9e9fa2e3-7e76-40d3-9303-38970be1a4f5 |LN-20260328-1998 |Jeboy M. Etang |2025-11-27T15:59:17.000Z |155.00 |3575.00 |pending |late |
| 1294ce23-673e-48d4-beda-f609f7cb339c |LN-20260328-0365 |Arcelene B. Castro |2025-11-27T16:00:00.000Z |310.00 |7760.00 |pending |late |
| 46f6d88b-8b18-4f31-b8aa-171558fdcf26 |LN-20260328-1998 |Jeboy M. Etang |2025-11-28T15:59:17.000Z |155.00 |3575.00 |pending |late |
| 3e709fbe-81e5-42bb-8b6b-546e2448904b |LN-20260328-0365 |Arcelene B. Castro |2025-11-28T16:00:00.000Z |310.00 |7760.00 |pending |late |
| e8b52381-d66e-45e0-a8b2-0bb1c18cc011 |LN-20260328-0365 |Arcelene B. Castro |2025-11-30T16:00:00.000Z |310.00 |7760.00 |pending |late |
| 78e9d6e5-a0fe-4888-bcb8-3c562988309e |LN-20260328-5685 |Maria Camila Lahoylahoy |2025-11-30T16:00:00.000Z |248.00 |7898.00 |pending |late |
| 5cf7847f-ce75-40cc-b5f9-4f287f1d79b1 |LN-20260328-0365 |Arcelene B. Castro |2025-12-01T16:00:00.000Z |310.00 |7760.00 |pending |late |
| 5317fe1f-d26e-49d1-a931-d7d1b985aeab |LN-20260328-5685 |Maria Camila Lahoylahoy |2025-12-01T16:00:00.000Z |248.00 |7898.00 |pending |late |
| cdd0b845-2d37-4e2d-8152-55963b496689 |LN-20260328-0365 |Arcelene B. Castro |2025-12-02T16:00:00.000Z |310.00 |7760.00 |pending |late |
| 7f204293-8ae0-418f-8a57-3837b03a585c |LN-20260328-1396 |Warlito R. Decio |2025-12-02T16:00:00.000Z |217.00 |7330.00 |pending |late |
| e41f6d31-d48a-4a73-aafb-2f2595ea3ba1 |LN-20260328-5685 |Maria Camila Lahoylahoy |2025-12-02T16:00:00.000Z |248.00 |7898.00 |pending |late |


## Payments Missing Schedule Link Samples

| id | loan_id | loan_number | borrower_name | amount | payment_date | receipt_number |
| --- | --- | --- | --- | --- | --- | --- |
| 8dcd9c04-3b49-42d8-97fd-d04839ace257 |80c012cb-8f4a-48be-8ac3-0a48dc512a57 |LN-20260420-185234-628551 |aaaaaaaaaa |700.00 |2026-04-21T16:00:00.000Z | |
| ccd1c584-610b-45c1-9c52-fec4bc6df2c4 |fd871ed6-5e7a-4a98-abf2-e0e00d159bd8 |LN-20260420-175922-638334 |Bryan Boyd Baldozanso |60400.00 |2026-04-20T17:05:46.394Z | |
| c08b2741-2013-4b00-b9f7-f08c597acc9f |4789d8cf-7950-4578-ae08-751a6b84bf65 |LN-20260421-010440-860105 |Bryan Boyd Baldozanso |2110.00 |2026-04-20T16:00:00.000Z | |
| fec5b44b-53bb-4e41-96b1-2f5b985aae06 |6f854696-0b6e-4d73-8ff3-9cf95cda812c |LN-20260418-112516-182133 |Dennis Lunzaga |5055.83 |2026-04-20T12:10:48.907Z | |
| 93d7ca61-05cc-4f79-a57c-a1bcd358bbe3 |89a5ae64-8ed0-4775-a63a-155e40c018ee |LN-20260417-1482 |Carolina L. Misperos |15080.00 |2026-04-20T11:19:55.568Z | |
| 61c136c6-5180-4c56-b064-7fca1185c9c0 |89a5ae64-8ed0-4775-a63a-155e40c018ee |LN-20260417-1482 |Carolina L. Misperos |15080.00 |2026-04-20T11:19:17.071Z | |
| 4ec9b58a-8551-4339-ada3-9c1541d4fc9b |89a5ae64-8ed0-4775-a63a-155e40c018ee |LN-20260417-1482 |Carolina L. Misperos |15080.00 |2026-04-20T10:19:15.014Z | |
| 91963aa0-0d81-44f0-be74-e1820112ca01 |9f720413-b0e8-45f8-b583-e39cb348bce0 |LN-20260328-5495 |Bryan Boyd Baldozanso |3950.00 |2026-04-20T09:59:22.699Z | |
| 5e484e01-ce6a-40ae-91ce-eee4bfa0e3b0 |57c93253-e079-4964-8f99-ba9635f2295b |LN-20260328-4465 |Irene J. Cabintoy |160.00 |2026-04-18T07:33:34.438Z |OR-20260418-153316-277690 |
| 309afe22-d2e4-4971-bb98-63ccd3a35b0c |57c93253-e079-4964-8f99-ba9635f2295b |LN-20260328-4465 |Irene J. Cabintoy |160.00 |2026-04-18T07:33:16.066Z |OR-20260418-153258-981875 |
| f1d79cd7-2647-4b86-b61c-380e3bf43cba |57c93253-e079-4964-8f99-ba9635f2295b |LN-20260328-4465 |Irene J. Cabintoy |160.00 |2026-04-18T07:32:58.302Z |OR-20260418-153225-560988 |
| a569e5b6-d22c-4adc-a502-6407c8aa4194 |57c93253-e079-4964-8f99-ba9635f2295b |LN-20260328-4465 |Irene J. Cabintoy |160.00 |2026-04-18T07:31:42.890Z |OR-20260418-153127-718541 |
| 39dd47d7-e8c4-4349-8649-514be329a48f |57c93253-e079-4964-8f99-ba9635f2295b |LN-20260328-4465 |Irene J. Cabintoy |160.00 |2026-04-18T07:31:27.555Z |OR-20260418-153110-243561 |
| 8c86d0d0-f27a-4b67-a657-dcf6c295ece6 |57c93253-e079-4964-8f99-ba9635f2295b |LN-20260328-4465 |Irene J. Cabintoy |160.00 |2026-04-18T07:31:10.601Z |OR-20260418-153054-736418 |
| 77b08755-1483-42f9-84e3-33e7ff6316e5 |f5eadabc-a712-41ea-9984-b0033c8ed106 |LN-20260328-6056 |Rowena Misperos |6582.00 |2026-04-18T03:51:05.715Z | |
| 97fbdd5d-2066-4641-8b55-03b55f04b0c4 |2d1b7164-8622-47e8-8d5f-85937b4edebe |LN-20260417-130819-013242 |Dennis Lunzaga |2215.00 |2026-04-18T03:25:16.173Z | |
| 3ca13e00-f30e-4ce4-9f92-1f0704547b46 |84b8fbfb-11f6-4d26-a1d3-da075f73da80 |LN-20260328-0404 |Marielle R. Decio |200.00 |2026-04-10T11:32:38.556Z | |
| 67e5a87b-f34c-4b82-b342-ac7bb0a1cebc |0940d99d-bcb8-4ba9-b710-3a39bcf34f83 |LN-20260328-0902 |Josephine Rufin |500.00 |2026-03-20T15:59:17.000Z | |
| 37a4adcc-6012-4ebb-9735-52cfa8b31224 |6cfb7186-b790-4352-b9ba-f6d83f4d2a7a |LN-20260328-6349 |Dionesia Rosal |222.00 |2026-03-20T15:59:17.000Z | |
| afd4f3e9-e553-486c-b769-be28d27db1d9 |416829ae-f435-4f28-ac7b-478a4970aa4d |LN-20260328-1410 |Martin B. Abad |320.00 |2026-03-20T15:59:17.000Z | |
| 77d77044-6815-4f66-b856-ac1ab6b16d20 |95c79497-d39a-4215-83f9-9f458c07d041 |LN-20260328-3226 |Aida Rosetase |315.00 |2026-03-20T15:59:17.000Z | |
| d75f7680-a882-407c-82c5-d4ecc7bdf973 |7b81081a-546a-47df-9a70-a56bd55556a1 |LN-20260328-9132 |Fely Solis |759.00 |2026-03-20T15:59:17.000Z | |
| d01553f1-026b-4e9f-9f6c-6bf2227118e8 |e815489b-dbdf-4013-9b93-e6c99bc9fe00 |LN-20260328-9731 |Armando F. Mondejar |300.00 |2026-03-20T15:59:17.000Z | |
| e5764c44-aa4c-40c7-b188-ac148c4b4186 |9a2daa13-7a72-4a92-935b-0d351c05ba51 |LN-20260328-2064 |Cristita Cagabhion |285.00 |2026-03-20T15:59:17.000Z | |
| 0e224197-f6d4-4b77-8cb6-73b3c536806c |e477c18f-a130-41af-bb26-0ff55ca06909 |LN-20260328-7295 |Haidee P. Gulane |253.00 |2026-03-20T15:59:17.000Z | |


## Potential Savings Overcredits

| loan_id | loan_number | borrower_name | loan_deposit_amount | auto_deposit_total | overcredit |
| --- | --- | --- | --- | --- | --- |
| 80c012cb-8f4a-48be-8ac3-0a48dc512a57 |LN-20260420-185234-628551 |aaaaaaaaaa |200.00 |1200.00 |1000.00 |
| 4789d8cf-7950-4578-ae08-751a6b84bf65 |LN-20260421-010440-860105 |Bryan Boyd Baldozanso |200.00 |400.00 |200.00 |


## Notes

- This report intentionally does not apply fixes.
- Existing historical statuses may encode imported business truth that is not reconstructable from payment totals alone.
- Any repair script should default to dry-run and require an explicit `--apply` flag.
- Conservative repair candidates are schedule status recomputation, renewal old-loan closure, and schedule link backfill where FIFO allocation is unambiguous.
