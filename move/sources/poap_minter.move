module 0x19619ad8c1ff22b0d9a34d605546c1cb42d7a627da27ff10c86e7c6a8da2f09f::poap_launchpad {
    use std::option::{Self, Option};
    use std::signer;
    use std::string::{Self, String};
    use std::vector;
    use aptos_std::simple_map::{Self, SimpleMap};
    use aptos_std::string_utils;
    use aptos_framework::object::{Self, Object};
    use aptos_framework::timestamp;
    use aptos_token_objects::collection::{Self, Collection};
    use aptos_token_objects::token::{Self, Token};
    use minter::token_components;
    use minter::mint_stage;
    use minter::collection_components;
    use aptos_std::event;

    // Error codes
    const ENO_ACTIVE_STAGES: u64 = 1;
    const EAT_LEAST_ONE_STAGE_IS_REQUIRED: u64 = 2;
    const EMINT_LIMIT_PER_ADDR_MUST_BE_SET_FOR_STAGE: u64 = 3;
    const DEFAULT_MINT_FEE_PER_NFT: u64 = 0;
    const ONE_HUNDRED_YEARS_IN_SECONDS: u64 = 100 * 365 * 24 * 60 * 60;
    const PUBLIC_MINT_MINT_STAGE_CATEGORY: vector<u8> = b"Public mint stage";

    struct CollectionOwnerObjConfig has key {
        collection_obj: Object<Collection>,
        extend_ref: object::ExtendRef,
    }
    struct CollectionConfig has key {
        mint_fee_per_nft_by_stages: SimpleMap<String, u64>,
        collection_owner_obj: Object<CollectionOwnerObjConfig>,
    }
    struct Registry has key {
        collection_objects: vector<Object<Collection>>,
    }
    #[event]
    struct CollectionCreatedEvent has drop, store {
        collection_obj_addr: address,
    }

    fun init_module(sender: &signer) {
        move_to(sender, Registry {
            collection_objects: vector::empty()
        });
    }

    // Entry: anyone can create collection
    public entry fun create_collection(
        _sender: &signer,
        description: String,
        name: String,
        uri: String,
        max_supply: u64,
        public_mint_start_time: Option<u64>,
        public_mint_end_time: Option<u64>,
        public_mint_limit_per_addr: Option<u64>,
        public_mint_fee_per_nft: Option<u64>,
    ) acquires Registry, CollectionConfig {
        let collection_owner_obj_constructor_ref = &object::create_object(@0x19619ad8c1ff22b0d9a34d605546c1cb42d7a627da27ff10c86e7c6a8da2f09f);
        let collection_owner_obj_signer = &object::generate_signer(collection_owner_obj_constructor_ref);
        let collection_obj_constructor_ref =
            &collection::create_fixed_collection(
                collection_owner_obj_signer,
                description,
                max_supply,
                name,
                option::none(), // no royalty
                uri,
            );
        let collection_obj_signer = &object::generate_signer(collection_obj_constructor_ref);
        let collection_obj_addr = signer::address_of(collection_obj_signer);
        let collection_obj = object::object_from_constructor_ref(collection_obj_constructor_ref);
        collection_components::create_refs_and_properties(collection_obj_constructor_ref);
        move_to(collection_owner_obj_signer, CollectionOwnerObjConfig {
            extend_ref: object::generate_extend_ref(collection_owner_obj_constructor_ref),
            collection_obj,
        });
        let collection_owner_obj = object::object_from_constructor_ref(collection_owner_obj_constructor_ref);
        move_to(collection_obj_signer, CollectionConfig {
            mint_fee_per_nft_by_stages: simple_map::new(),
            collection_owner_obj,
        });
        assert!(option::is_some(&public_mint_start_time), EAT_LEAST_ONE_STAGE_IS_REQUIRED);
        if (option::is_some(&public_mint_start_time)) {
            add_public_mint_stage(
                collection_obj,
                collection_obj_addr,
                collection_obj_signer,
                collection_owner_obj_signer,
                *option::borrow(&public_mint_start_time),
                public_mint_end_time,
                public_mint_limit_per_addr,
                public_mint_fee_per_nft,
            );
        };
        let registry = borrow_global_mut<Registry>(@0x19619ad8c1ff22b0d9a34d605546c1cb42d7a627da27ff10c86e7c6a8da2f09f);
        vector::push_back(&mut registry.collection_objects, collection_obj);
        // Emit event for frontend extraction
        event::emit(CollectionCreatedEvent {
            collection_obj_addr: collection_obj_addr,
        });
    }

    // Entry: public mint, 1-per-wallet, now with custom metadata URI
    public entry fun mint_nft(
        sender: &signer,
        collection_obj: Object<Collection>,
        metadata_uri: String,
    ) acquires CollectionConfig, CollectionOwnerObjConfig {
        let sender_addr = signer::address_of(sender);
        let amount = 1;
        let stage_idx = &mint_stage::execute_earliest_stage(sender, collection_obj, amount);
        assert!(option::is_some(stage_idx), ENO_ACTIVE_STAGES);
        let stage_obj = mint_stage::find_mint_stage_by_index(collection_obj, *option::borrow(stage_idx));
        let stage_name = mint_stage::mint_stage_name(stage_obj);
        let total_mint_fee = get_mint_fee(collection_obj, stage_name, amount);
        pay_for_mint(sender, total_mint_fee);
        let _nft_obj = mint_nft_internal_with_uri(sender_addr, collection_obj, metadata_uri);
    }

    // Internal mint with custom metadata URI
    fun mint_nft_internal_with_uri(
        sender_addr: address,
        collection_obj: Object<Collection>,
        metadata_uri: String,
    ): Object<Token> acquires CollectionConfig, CollectionOwnerObjConfig {
        let collection_config = borrow_global<CollectionConfig>(object::object_address(&collection_obj));
        let collection_owner_obj = collection_config.collection_owner_obj;
        let collection_owner_config = borrow_global<CollectionOwnerObjConfig>(
            object::object_address(&collection_owner_obj)
        );
        let collection_owner_obj_signer = &object::generate_signer_for_extending(&collection_owner_config.extend_ref);
        let next_nft_id = *option::borrow(&collection::count(collection_obj)) + 1;
        let nft_obj_constructor_ref = &token::create(
            collection_owner_obj_signer,
            collection::name(collection_obj),
            string_utils::to_string(&next_nft_id),
            string_utils::to_string(&next_nft_id),
            option::none(), // no royalty
            metadata_uri,
        );
        token_components::create_refs(nft_obj_constructor_ref);
        let nft_obj = object::object_from_constructor_ref(nft_obj_constructor_ref);
        object::transfer(collection_owner_obj_signer, nft_obj, sender_addr);
        nft_obj
    }

    // Views
    #[view]
    public fun get_registry(): vector<Object<Collection>> acquires Registry {
        let registry = borrow_global<Registry>(@0x19619ad8c1ff22b0d9a34d605546c1cb42d7a627da27ff10c86e7c6a8da2f09f);
        registry.collection_objects
    }
    #[view]
    public fun get_mint_fee(
        collection_obj: Object<Collection>,
        stage_name: String,
        amount: u64,
    ): u64 acquires CollectionConfig {
        let collection_config = borrow_global<CollectionConfig>(object::object_address(&collection_obj));
        let fee = *simple_map::borrow(&collection_config.mint_fee_per_nft_by_stages, &stage_name);
        amount * fee
    }
    #[view]
    public fun get_active_or_next_mint_stage(collection_obj: Object<Collection>): Option<String> {
        let active_stage_idx = mint_stage::ccurent_active_stage(collection_obj);
        if (option::is_some(&active_stage_idx)) {
            let stage_obj = mint_stage::find_mint_stage_by_index(collection_obj, *option::borrow(&active_stage_idx));
            let stage_name = mint_stage::mint_stage_name(stage_obj);
            option::some(stage_name)
        } else {
            let stages = mint_stage::stages(collection_obj);
            for (i in 0..vector::length(&stages)) {
                let stage_name = *vector::borrow(&stages, i);
                let stage_idx = mint_stage::find_mint_stage_index_by_name(collection_obj, stage_name);
                if (mint_stage::start_time(collection_obj, stage_idx) > timestamp::now_seconds()) {
                    return option::some(stage_name)
                }
            };
            option::none()
        }
    }
    #[view]
    public fun get_mint_stage_start_and_end_time(collection_obj: Object<Collection>, stage_name: String): (u64, u64) {
        let stage_idx = mint_stage::find_mint_stage_index_by_name(collection_obj, stage_name);
        let stage_obj = mint_stage::find_mint_stage_by_index(collection_obj, stage_idx);
        let start_time = mint_stage::mint_stage_start_time(stage_obj);
        let end_time = mint_stage::mint_stage_end_time(stage_obj);
        (start_time, end_time)
    }

    // Helpers
    fun add_public_mint_stage(
        collection_obj: Object<Collection>,
        collection_obj_addr: address,
        collection_obj_signer: &signer,
        collection_owner_obj_signer: &signer,
        public_mint_start_time: u64,
        public_mint_end_time: Option<u64>,
        public_mint_limit_per_addr: Option<u64>,
        public_mint_fee_per_nft: Option<u64>,
    ) acquires CollectionConfig {
        assert!(option::is_some(&public_mint_limit_per_addr), EMINT_LIMIT_PER_ADDR_MUST_BE_SET_FOR_STAGE);
        let stage = string::utf8(PUBLIC_MINT_MINT_STAGE_CATEGORY);
        mint_stage::create(
            collection_obj_signer,
            stage,
            public_mint_start_time,
            *option::borrow_with_default(
                &public_mint_end_time,
                &(ONE_HUNDRED_YEARS_IN_SECONDS + public_mint_start_time)
            ),
        );
        let stage_idx = mint_stage::find_mint_stage_index_by_name(collection_obj, stage);
        if (option::is_some(&public_mint_limit_per_addr)) {
            mint_stage::upsert_public_stage_max_per_user(
                collection_owner_obj_signer,
                collection_obj,
                stage_idx,
                *option::borrow(&public_mint_limit_per_addr)
            );
        };
        let collection_config = borrow_global_mut<CollectionConfig>(collection_obj_addr);
        simple_map::upsert(
            &mut collection_config.mint_fee_per_nft_by_stages,
            stage,
            *option::borrow_with_default(&public_mint_fee_per_nft, &DEFAULT_MINT_FEE_PER_NFT),
        );
    }
    fun pay_for_mint(_sender: &signer, mint_fee: u64) {
        if (mint_fee > 0) {
            // For POAP, mint fee is usually 0, but logic is here if needed
        }
    }
    fun mint_nft_internal(
        sender_addr: address,
        collection_obj: Object<Collection>,
    ): Object<Token> acquires CollectionConfig, CollectionOwnerObjConfig {
        let collection_config = borrow_global<CollectionConfig>(object::object_address(&collection_obj));
        let collection_owner_obj = collection_config.collection_owner_obj;
        let collection_owner_config = borrow_global<CollectionOwnerObjConfig>(
            object::object_address(&collection_owner_obj)
        );
        let collection_owner_obj_signer = &object::generate_signer_for_extending(&collection_owner_config.extend_ref);
        let next_nft_id = *option::borrow(&collection::count(collection_obj)) + 1;
        let collection_uri = collection::uri(collection_obj);
        let nft_metadata_uri = construct_nft_metadata_uri(&collection_uri, next_nft_id);
        let nft_obj_constructor_ref = &token::create(
            collection_owner_obj_signer,
            collection::name(collection_obj),
            string_utils::to_string(&next_nft_id),
            string_utils::to_string(&next_nft_id),
            option::none(), // no royalty
            nft_metadata_uri,
        );
        token_components::create_refs(nft_obj_constructor_ref);
        let nft_obj = object::object_from_constructor_ref(nft_obj_constructor_ref);
        object::transfer(collection_owner_obj_signer, nft_obj, sender_addr);
        nft_obj
    }
    fun construct_nft_metadata_uri(
        collection_uri: &String,
        next_nft_id: u64,
    ): String {
        let nft_metadata_uri = &mut string::sub_string(
            collection_uri,
            0,
            string::length(collection_uri) - string::length(&string::utf8(b"collection.json"))
        );
        let nft_metadata_filename = string_utils::format1(&b"{}.json", next_nft_id);
        string::append(nft_metadata_uri, nft_metadata_filename);
        *nft_metadata_uri
    }

    #[test_only]
    use aptos_framework::account;
    #[test_only]
    use aptos_framework::coin;
    #[test_only]
    use aptos_framework::aptos_coin::{Self, AptosCoin};

    #[test(aptos_framework = @0x1, user1 = @0x2, user2 = @0x3, minter = @0x19619ad8c1ff22b0d9a34d605546c1cb42d7a627da27ff10c86e7c6a8da2f09f)]
    fun test_create_and_mint(
        aptos_framework: &signer,
        user1: &signer,
        user2: &signer,
        minter: &signer,
    ) acquires Registry, CollectionConfig, CollectionOwnerObjConfig {
        // Setup test accounts and coin
        let (burn_cap, mint_cap) = aptos_framework::aptos_coin::initialize_for_test(aptos_framework);
        aptos_framework::timestamp::set_time_has_started_for_testing(aptos_framework);
        account::create_account_for_test(signer::address_of(user1));
        account::create_account_for_test(signer::address_of(user2));
        coin::register<AptosCoin>(user1);
        coin::register<AptosCoin>(user2);

        // Initialize registry under module address
        init_module(minter);

        // Create a collection
        let start_time = 0;
        let end_time = 1000;
        let limit = 1;
        let fee = 0;
        create_collection(
            minter,
            string::utf8(b"Test collection"),
            string::utf8(b"Test"),
            string::utf8(b"https://example.com/collection.json"),
            10,
            option::some(start_time),
            option::some(end_time),
            option::some(limit),
            option::some(fee),
        );
        let registry = get_registry();
        let collection = *vector::borrow(&registry, 0);

        // Mint for user1
        mint_nft(user1, collection);
        // Mint for user2
        mint_nft(user2, collection);
        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
    }

    #[test(aptos_framework = @0x1, user1 = @0x2, minter = @0x19619ad8c1ff22b0d9a34d605546c1cb42d7a627da27ff10c86e7c6a8da2f09f)]
    #[expected_failure]
    fun test_double_mint_should_fail(
        aptos_framework: &signer,
        user1: &signer,
        minter: &signer,
    ) acquires Registry, CollectionConfig, CollectionOwnerObjConfig {
        // Setup test accounts and coin
        let (burn_cap, mint_cap) = aptos_framework::aptos_coin::initialize_for_test(aptos_framework);
        aptos_framework::timestamp::set_time_has_started_for_testing(aptos_framework);
        account::create_account_for_test(signer::address_of(user1));
        coin::register<AptosCoin>(user1);
        // Initialize registry under module address
        init_module(minter);
        // Create a collection
        let start_time = 0;
        let end_time = 1000;
        let limit = 1;
        let fee = 0;
        create_collection(
            minter,
            string::utf8(b"Test collection"),
            string::utf8(b"Test"),
            string::utf8(b"https://example.com/collection.json"),
            10,
            option::some(start_time),
            option::some(end_time),
            option::some(limit),
            option::some(fee),
        );
        let registry = get_registry();
        let collection = *vector::borrow(&registry, 0);
        // Mint for user1 (should succeed)
        mint_nft(user1, collection);
        // Mint again for user1 (should fail, triggers expected_failure)
        mint_nft(user1, collection);
        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
    }
}