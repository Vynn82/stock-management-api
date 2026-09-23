--
-- PostgreSQL database dump
--

\restrict 0ba3KQhn0vxVNVBFRLnnfXnpuNKHW0mcDTBvYkjkdDqqJk445s1Psmq3cZUj5eC

-- Dumped from database version 16.15 (Debian 16.15-1.pgdg13+2)
-- Dumped by pg_dump version 16.15 (Debian 16.15-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: approver_action_type_enum; Type: TYPE; Schema: public; Owner: Vynn82
--

CREATE TYPE public.approver_action_type_enum AS ENUM (
    'CERTIFIER',
    'APPROVER'
);


ALTER TYPE public.approver_action_type_enum OWNER TO "Vynn82";

--
-- Name: approver_status_enum; Type: TYPE; Schema: public; Owner: Vynn82
--

CREATE TYPE public.approver_status_enum AS ENUM (
    'WAITING',
    'PENDING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public.approver_status_enum OWNER TO "Vynn82";

--
-- Name: request_source_enum; Type: TYPE; Schema: public; Owner: Vynn82
--

CREATE TYPE public.request_source_enum AS ENUM (
    'MANUAL',
    'EXCEL'
);


ALTER TYPE public.request_source_enum OWNER TO "Vynn82";

--
-- Name: request_status_enum; Type: TYPE; Schema: public; Owner: Vynn82
--

CREATE TYPE public.request_status_enum AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public.request_status_enum OWNER TO "Vynn82";

--
-- Name: request_type_enum; Type: TYPE; Schema: public; Owner: Vynn82
--

CREATE TYPE public.request_type_enum AS ENUM (
    'PRODUCT_CREATE',
    'PRODUCT_UPDATE',
    'VARIANT_CREATE',
    'VARIANT_UPDATE',
    'STOCK_IN',
    'STOCK_OUT',
    'STOCK_TRANSFER',
    'STOCK_ADJUSTMENT'
);


ALTER TYPE public.request_type_enum OWNER TO "Vynn82";

--
-- Name: users_status_enum; Type: TYPE; Schema: public; Owner: Vynn82
--

CREATE TYPE public.users_status_enum AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'LOCKED'
);


ALTER TYPE public.users_status_enum OWNER TO "Vynn82";

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: approvers; Type: TABLE; Schema: public; Owner: Vynn82
--

CREATE TABLE public.approvers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    request_id uuid NOT NULL,
    user_id uuid NOT NULL,
    step integer NOT NULL,
    action_type public.approver_action_type_enum NOT NULL,
    status public.approver_status_enum DEFAULT 'WAITING'::public.approver_status_enum NOT NULL,
    action_date timestamp without time zone,
    remark text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.approvers OWNER TO "Vynn82";

--
-- Name: brands; Type: TABLE; Schema: public; Owner: Vynn82
--

CREATE TABLE public.brands (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.brands OWNER TO "Vynn82";

--
-- Name: categories; Type: TABLE; Schema: public; Owner: Vynn82
--

CREATE TABLE public.categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.categories OWNER TO "Vynn82";

--
-- Name: mails; Type: TABLE; Schema: public; Owner: Vynn82
--

CREATE TABLE public.mails (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    recipient_id uuid NOT NULL,
    request_id uuid NOT NULL,
    request_type character varying NOT NULL,
    subject character varying NOT NULL,
    message text NOT NULL,
    action character varying NOT NULL,
    request_url character varying NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.mails OWNER TO "Vynn82";

--
-- Name: menus; Type: TABLE; Schema: public; Owner: Vynn82
--

CREATE TABLE public.menus (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    label character varying(100) NOT NULL,
    path character varying(255),
    icon character varying(100),
    parent_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.menus OWNER TO "Vynn82";

--
-- Name: migrations; Type: TABLE; Schema: public; Owner: Vynn82
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


ALTER TABLE public.migrations OWNER TO "Vynn82";

--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: Vynn82
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.migrations_id_seq OWNER TO "Vynn82";

--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: Vynn82
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: Vynn82
--

CREATE TABLE public.permissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    resource character varying(100) NOT NULL,
    action character varying(50) NOT NULL,
    is_system boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.permissions OWNER TO "Vynn82";

--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: Vynn82
--

CREATE TABLE public.product_variants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    product_id uuid NOT NULL,
    code character varying(100) NOT NULL,
    name character varying(200) NOT NULL,
    sku character varying(100) NOT NULL,
    barcode character varying(100),
    attributes jsonb,
    cost_price numeric(15,2),
    selling_price numeric(15,2),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    image text
);


ALTER TABLE public.product_variants OWNER TO "Vynn82";

--
-- Name: products; Type: TABLE; Schema: public; Owner: Vynn82
--

CREATE TABLE public.products (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    category_id uuid NOT NULL,
    brand_id uuid,
    supplier_id uuid,
    has_variants boolean DEFAULT false NOT NULL,
    unit character varying(30) NOT NULL,
    barcode character varying(100),
    sku character varying(100) NOT NULL,
    cost_price numeric(15,2) DEFAULT 0 NOT NULL,
    selling_price numeric(15,2) DEFAULT 0 NOT NULL,
    minimum_stock numeric(15,3) DEFAULT 0 NOT NULL,
    maximum_stock numeric(15,3),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    image text
);


ALTER TABLE public.products OWNER TO "Vynn82";

--
-- Name: request_items; Type: TABLE; Schema: public; Owner: Vynn82
--

CREATE TABLE public.request_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    request_id uuid NOT NULL,
    product_code character varying(50) NOT NULL,
    product_name character varying(200) NOT NULL,
    description text,
    category_code character varying(50) NOT NULL,
    brand_code character varying(50),
    supplier_code character varying(50),
    has_variants boolean DEFAULT false NOT NULL,
    unit character varying(30) NOT NULL,
    product_sku character varying(100) NOT NULL,
    product_barcode character varying(100),
    product_cost_price numeric(15,2),
    product_selling_price numeric(15,2),
    minimum_stock numeric(15,3),
    maximum_stock numeric(15,3),
    variant_code character varying(100),
    variant_name character varying(200),
    variant_sku character varying(100),
    variant_barcode character varying(100),
    variant_attributes jsonb,
    variant_cost_price numeric(15,2),
    variant_selling_price numeric(15,2),
    warehouse_code character varying(50),
    quantity numeric(15,3),
    from_warehouse_code character varying(50),
    to_warehouse_code character varying(50),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    product_image text,
    variant_image text,
    adjustment_type character varying(20),
    adjustment_reason text,
    CONSTRAINT "CHK_request_items_adjustment_type" CHECK (((adjustment_type IS NULL) OR ((adjustment_type)::text = ANY ((ARRAY['INCREASE'::character varying, 'DECREASE'::character varying])::text[]))))
);


ALTER TABLE public.request_items OWNER TO "Vynn82";

--
-- Name: requests; Type: TABLE; Schema: public; Owner: Vynn82
--

CREATE TABLE public.requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    request_no character varying(50) NOT NULL,
    requester_id uuid NOT NULL,
    request_type public.request_type_enum NOT NULL,
    source public.request_source_enum NOT NULL,
    status public.request_status_enum DEFAULT 'PENDING'::public.request_status_enum NOT NULL,
    current_step integer DEFAULT 1 NOT NULL,
    remark text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.requests OWNER TO "Vynn82";

--
-- Name: role_menus; Type: TABLE; Schema: public; Owner: Vynn82
--

CREATE TABLE public.role_menus (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    role_id uuid NOT NULL,
    menu_id uuid NOT NULL
);


ALTER TABLE public.role_menus OWNER TO "Vynn82";

--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: Vynn82
--

CREATE TABLE public.role_permissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO "Vynn82";

--
-- Name: roles; Type: TABLE; Schema: public; Owner: Vynn82
--

CREATE TABLE public.roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(50) NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.roles OWNER TO "Vynn82";

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: Vynn82
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    refresh_token_hash character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    last_used_at timestamp with time zone,
    user_agent character varying(500),
    ip_address character varying(45),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.sessions OWNER TO "Vynn82";

--
-- Name: staff_id_seq; Type: SEQUENCE; Schema: public; Owner: Vynn82
--

CREATE SEQUENCE public.staff_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.staff_id_seq OWNER TO "Vynn82";

--
-- Name: stock_adjustments; Type: TABLE; Schema: public; Owner: Vynn82
--

CREATE TABLE public.stock_adjustments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    request_id uuid,
    product_id uuid NOT NULL,
    variant_id uuid,
    warehouse_id uuid NOT NULL,
    adjustment_type character varying(20) NOT NULL,
    quantity numeric(15,3) NOT NULL,
    reason text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    adjusted_by_id uuid,
    CONSTRAINT "CHK_stock_adjustments_quantity" CHECK ((quantity > (0)::numeric)),
    CONSTRAINT "CHK_stock_adjustments_type" CHECK (((adjustment_type)::text = ANY ((ARRAY['INCREASE'::character varying, 'DECREASE'::character varying])::text[])))
);


ALTER TABLE public.stock_adjustments OWNER TO "Vynn82";

--
-- Name: stocks; Type: TABLE; Schema: public; Owner: Vynn82
--

CREATE TABLE public.stocks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid,
    warehouse_id uuid NOT NULL,
    quantity numeric(15,3) DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.stocks OWNER TO "Vynn82";

--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: Vynn82
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(150) NOT NULL,
    contact_person character varying(100),
    phone character varying(50),
    email character varying(150),
    address text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.suppliers OWNER TO "Vynn82";

--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: Vynn82
--

CREATE TABLE public.user_profiles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(30),
    telegram_chat_id character varying(100),
    avatar character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_profiles OWNER TO "Vynn82";

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: Vynn82
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL
);


ALTER TABLE public.user_roles OWNER TO "Vynn82";

--
-- Name: users; Type: TABLE; Schema: public; Owner: Vynn82
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    staff_id character varying(8) NOT NULL,
    password_hash character varying(255) NOT NULL,
    status public.users_status_enum DEFAULT 'ACTIVE'::public.users_status_enum NOT NULL,
    must_change_password boolean DEFAULT true NOT NULL,
    created_by uuid,
    last_login_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO "Vynn82";

--
-- Name: warehouses; Type: TABLE; Schema: public; Owner: Vynn82
--

CREATE TABLE public.warehouses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    address text,
    latitude numeric(10,7),
    longitude numeric(10,7),
    contact_person character varying(100),
    phone character varying(50),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.warehouses OWNER TO "Vynn82";

--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Data for Name: approvers; Type: TABLE DATA; Schema: public; Owner: Vynn82
--

COPY public.approvers (id, request_id, user_id, step, action_type, status, action_date, remark, created_at, updated_at) FROM stdin;
759bdabc-e085-4518-a70c-cf8d321f2e46	5b6b75f3-fed1-4c68-aedf-e4a41aabcba3	693a56ed-5436-4756-ba32-ff09e691fbfd	1	CERTIFIER	PENDING	\N	\N	2026-09-04 16:39:51.774932	2026-09-04 16:39:51.774932
c1eb9545-0be4-4fe8-944e-3636a8785e1b	5b6b75f3-fed1-4c68-aedf-e4a41aabcba3	ba5249c1-bcd2-4647-9206-145a3f73c45c	2	CERTIFIER	WAITING	\N	\N	2026-09-04 16:39:51.774932	2026-09-04 16:39:51.774932
b7e49219-789f-467d-8016-5e17ea585779	5b6b75f3-fed1-4c68-aedf-e4a41aabcba3	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	3	APPROVER	WAITING	\N	\N	2026-09-04 16:39:51.774932	2026-09-04 16:39:51.774932
7c1895f2-1770-47ca-9bff-b38ebf4af345	717b60c1-d5b4-417b-8f83-dc4777333d3e	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	3	APPROVER	WAITING	\N	\N	2026-09-04 16:55:30.189968	2026-09-04 16:55:30.189968
e889041b-af68-4eb5-8af7-c534ccb2d5d8	717b60c1-d5b4-417b-8f83-dc4777333d3e	693a56ed-5436-4756-ba32-ff09e691fbfd	1	CERTIFIER	APPROVED	2026-09-05 00:06:24.248	Everything is correct	2026-09-04 16:55:30.189968	2026-09-04 17:06:24.246106
21b859ef-4945-4607-af2d-d97faf018267	717b60c1-d5b4-417b-8f83-dc4777333d3e	ba5249c1-bcd2-4647-9206-145a3f73c45c	2	CERTIFIER	PENDING	\N	\N	2026-09-04 16:55:30.189968	2026-09-04 17:06:24.246106
d969730e-8993-45c7-9e41-bf76317f4b54	5c548293-3e02-4bef-866b-0a3bfde93617	693a56ed-5436-4756-ba32-ff09e691fbfd	1	CERTIFIER	PENDING	\N	\N	2026-09-05 14:33:52.172104	2026-09-05 14:33:52.172104
f9c8bcb0-a0b6-4199-9970-e4abf3090249	5c548293-3e02-4bef-866b-0a3bfde93617	ba5249c1-bcd2-4647-9206-145a3f73c45c	2	CERTIFIER	WAITING	\N	\N	2026-09-05 14:33:52.172104	2026-09-05 14:33:52.172104
d78f8cd0-1399-432f-93fd-a2318d08cc43	5c548293-3e02-4bef-866b-0a3bfde93617	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	3	APPROVER	WAITING	\N	\N	2026-09-05 14:33:52.172104	2026-09-05 14:33:52.172104
e5ec481c-311e-4977-938d-10491f883146	bc07dfb3-41a4-4e10-9248-a2d8ffa02723	693a56ed-5436-4756-ba32-ff09e691fbfd	1	CERTIFIER	PENDING	\N	\N	2026-09-05 14:46:52.268774	2026-09-05 14:46:52.268774
0d95b825-c62a-4244-a348-a648705e71ce	bc07dfb3-41a4-4e10-9248-a2d8ffa02723	ba5249c1-bcd2-4647-9206-145a3f73c45c	2	CERTIFIER	WAITING	\N	\N	2026-09-05 14:46:52.268774	2026-09-05 14:46:52.268774
fab20d73-c285-4511-a277-f8eaf1647eca	bc07dfb3-41a4-4e10-9248-a2d8ffa02723	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	3	APPROVER	WAITING	\N	\N	2026-09-05 14:46:52.268774	2026-09-05 14:46:52.268774
bea11dd3-fee1-4789-b5ab-d75abeedf0f9	d9caf790-9587-49e4-baf9-c7cccd172fa4	693a56ed-5436-4756-ba32-ff09e691fbfd	1	CERTIFIER	APPROVED	2026-09-07 21:30:39.568	Everything is correct	2026-09-05 14:28:26.141553	2026-09-07 14:30:39.565467
7c0055c9-4a62-4f9b-9bc8-d0b29e9bbf1a	d9caf790-9587-49e4-baf9-c7cccd172fa4	ba5249c1-bcd2-4647-9206-145a3f73c45c	2	CERTIFIER	APPROVED	2026-09-07 22:02:02.317	Everything is correct	2026-09-05 14:28:26.141553	2026-09-07 15:02:02.313046
79b5c69b-8145-4042-93cf-39f8d9617a07	d9caf790-9587-49e4-baf9-c7cccd172fa4	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	3	APPROVER	APPROVED	2026-09-07 22:08:11.618	Everything is correct	2026-09-05 14:28:26.141553	2026-09-07 15:08:11.615803
1d6988ee-f46e-43d3-a8b8-0563c1e6a525	c356d4f0-5780-4619-9675-89a6fc23dd60	693a56ed-5436-4756-ba32-ff09e691fbfd	1	CERTIFIER	PENDING	\N	\N	2026-09-07 15:36:41.107358	2026-09-07 15:36:41.107358
ee7e2cfe-f18c-4b34-96dd-92183fa82421	c356d4f0-5780-4619-9675-89a6fc23dd60	ba5249c1-bcd2-4647-9206-145a3f73c45c	2	CERTIFIER	WAITING	\N	\N	2026-09-07 15:36:41.107358	2026-09-07 15:36:41.107358
1df5b8e8-248a-47f2-bf00-3caebcb45bfc	c356d4f0-5780-4619-9675-89a6fc23dd60	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	3	APPROVER	WAITING	\N	\N	2026-09-07 15:36:41.107358	2026-09-07 15:36:41.107358
4ac49ae5-f740-4725-9ef7-757e9cc9a459	91d31cc4-bd53-4a6c-b6c3-1d30e5af54a0	693a56ed-5436-4756-ba32-ff09e691fbfd	1	CERTIFIER	APPROVED	2026-09-07 23:01:34.422	Everything is correct	2026-09-07 15:56:55.60834	2026-09-07 16:01:34.412005
d8c4c93f-f379-4127-927e-9c1ff0bf9b5f	34520eab-87eb-4b4d-848c-30cd2e2ad415	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	3	APPROVER	APPROVED	2026-09-09 21:56:19.693	Everything is correct	2026-09-09 14:33:53.303513	2026-09-09 14:56:19.665555
bd3d8a3b-081c-4495-b8ce-3bec0f5d6ebc	91d31cc4-bd53-4a6c-b6c3-1d30e5af54a0	ba5249c1-bcd2-4647-9206-145a3f73c45c	2	CERTIFIER	APPROVED	2026-09-07 23:05:03.471	Everything is correct	2026-09-07 15:56:55.60834	2026-09-07 16:05:03.463625
73230677-f69f-4723-b2a7-9a986480bd78	d0d99013-911b-4eb7-a4b1-4476f77ddc22	693a56ed-5436-4756-ba32-ff09e691fbfd	1	APPROVER	PENDING	\N	\N	2026-09-20 08:29:37.837704	2026-09-20 08:29:37.837704
b52ffacb-91ca-4b24-bda4-bad38fa325f3	91d31cc4-bd53-4a6c-b6c3-1d30e5af54a0	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	3	APPROVER	APPROVED	2026-09-07 23:06:59.29	Everything is correct	2026-09-07 15:56:55.60834	2026-09-07 16:06:59.282075
b1b47efa-92c4-45d5-9662-fc53d0b8cadc	34520eab-87eb-4b4d-848c-30cd2e2ad415	693a56ed-5436-4756-ba32-ff09e691fbfd	1	CERTIFIER	APPROVED	2026-09-09 21:37:46.426	Everything is correct	2026-09-09 14:33:53.303513	2026-09-09 14:37:46.409538
c5c5048c-196d-46ab-82d7-9f3e89ca88a6	6e1cd7b4-0a38-40c0-9ce5-64716f05ee40	693a56ed-5436-4756-ba32-ff09e691fbfd	1	APPROVER	PENDING	\N	\N	2026-09-20 08:31:14.566599	2026-09-20 08:31:14.566599
2579807d-0849-45f7-bded-9d50eb31380e	34520eab-87eb-4b4d-848c-30cd2e2ad415	ba5249c1-bcd2-4647-9206-145a3f73c45c	2	CERTIFIER	APPROVED	2026-09-09 21:38:20.348	Everything is correct	2026-09-09 14:33:53.303513	2026-09-09 14:38:20.342123
6f13549d-a633-4c20-b896-29a0ddc57391	ad8fdccb-a166-427d-adc2-ecc617e70212	693a56ed-5436-4756-ba32-ff09e691fbfd	1	APPROVER	PENDING	\N	\N	2026-09-20 08:31:14.614911	2026-09-20 08:31:14.614911
e80ecf90-f8ee-4ec7-af84-79df6e5604d0	5429ae7c-5a1d-4dc4-85e1-ad79e734c449	693a56ed-5436-4756-ba32-ff09e691fbfd	1	APPROVER	PENDING	\N	\N	2026-09-20 08:33:00.01719	2026-09-20 08:33:00.01719
933376e7-9936-4298-9c4a-7720d2f39511	22ba5fc8-e095-474e-bf0f-7aa421a8621d	693a56ed-5436-4756-ba32-ff09e691fbfd	1	APPROVER	PENDING	\N	\N	2026-09-20 08:33:31.025722	2026-09-20 08:33:31.025722
2e36c371-d24a-49a6-88bf-e354c9f03c50	65c6da8b-27c6-41c6-82a7-37ba0309f57c	693a56ed-5436-4756-ba32-ff09e691fbfd	1	APPROVER	APPROVED	2026-09-20 15:34:12.468	Approved manual stock adjustment	2026-09-20 08:34:12.435382	2026-09-20 08:34:12.459914
14bfa079-cdad-4a0d-a431-be61a583dab1	6fc4bf67-1139-456f-9779-6868b7b3ca99	693a56ed-5436-4756-ba32-ff09e691fbfd	1	APPROVER	PENDING	\N	\N	2026-09-20 08:37:38.856694	2026-09-20 08:37:38.856694
31f3f4ad-8e62-4d6a-8e5f-beba9f43a4a6	caa64ea0-e792-4dd8-a143-45ed47227298	693a56ed-5436-4756-ba32-ff09e691fbfd	1	APPROVER	PENDING	\N	\N	2026-09-20 08:37:38.903025	2026-09-20 08:37:38.903025
1d36ab16-bbf1-4908-94ad-87809774207c	102ae3c3-ed37-4afe-85b2-32b6d1dedcdf	693a56ed-5436-4756-ba32-ff09e691fbfd	1	APPROVER	APPROVED	2026-09-20 15:37:55.476	Approved Case 1	2026-09-20 08:37:55.44252	2026-09-20 08:37:55.467319
92e6a4e1-d0a0-443f-90bd-5c85d98c815b	8dfa53fc-612c-4a03-b7da-f8aff69ad4cc	693a56ed-5436-4756-ba32-ff09e691fbfd	1	APPROVER	APPROVED	2026-09-20 15:37:55.527	Approved Case 2	2026-09-20 08:37:55.504545	2026-09-20 08:37:55.520085
61016667-a9b0-4f55-a3bb-b37147ab5dd3	f67c4089-45e2-4d03-83b4-495dfd1e06a3	ba5249c1-bcd2-4647-9206-145a3f73c45c	1	CERTIFIER	PENDING	\N	\N	2026-09-20 11:05:35.631814	2026-09-20 11:05:35.631814
f9c9d24c-67c7-484d-9de1-ade0acf06813	f67c4089-45e2-4d03-83b4-495dfd1e06a3	693a56ed-5436-4756-ba32-ff09e691fbfd	2	APPROVER	WAITING	\N	\N	2026-09-20 11:05:35.631814	2026-09-20 11:05:35.631814
80426eda-6fb7-4163-ae38-46c6e90cf760	041f1000-5d61-4df7-aabf-bd05df03277e	693a56ed-5436-4756-ba32-ff09e691fbfd	1	APPROVER	PENDING	\N	\N	2026-09-20 11:23:21.949434	2026-09-20 11:23:21.949434
\.


--
-- Data for Name: brands; Type: TABLE DATA; Schema: public; Owner: Vynn82
--

COPY public.brands (id, code, name, description, is_active, created_at, updated_at) FROM stdin;
bb08e22a-8577-448b-8906-a58f5a727342	SAMSUNG	Samsung	Samsung electronics	t	2026-08-31 14:42:53.750987	2026-08-31 14:42:53.750987
45d98ac4-e88f-4c56-97d3-d4d1207289b5	BRD-83305	Test Brand BRD-83305	Updated brand description	t	2026-09-20 07:54:43.310008	2026-09-20 07:54:43.339694
dfe8f826-ac1e-42ea-9200-14eec0573444	BRD-08954	Test Brand BRD-08954	Updated brand description	t	2026-09-20 07:55:08.957774	2026-09-20 07:55:08.986049
d1b780ed-8b0e-4486-af9d-e87587f62233	BRD-20695	Test Brand BRD-20695	Updated brand description	t	2026-09-20 07:55:20.698985	2026-09-20 07:55:20.725599
fcbadba7-f9d2-4e65-8293-dfaeff6c32bc	BRD-49294	Test Brand BRD-49294	Updated brand description	t	2026-09-20 07:55:49.298229	2026-09-20 07:55:49.326757
de18960c-07a5-4225-9fe2-c94647b1e85c	APPLE	Samsung Global	Updated description	t	2026-08-31 14:42:45.628449	2026-09-20 10:04:16.620334
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: Vynn82
--

COPY public.categories (id, code, name, description, is_active, created_at, updated_at) FROM stdin;
2f1dad29-6f6d-4044-8f1d-0e74b6107f12	SMARTPHONE	Smartphone	Mobile phones and smartphones	t	2026-08-31 14:42:38.330209	2026-08-31 14:42:38.330209
56964f08-d6d9-40bd-907c-d148f6b3906b	CAT-83263	Test Category CAT-83263	Updated category description	t	2026-09-20 07:54:43.269295	2026-09-20 07:54:43.302784
60789a77-e4e2-411e-bdff-c27b0208c895	CAT-08918	Test Category CAT-08918	Updated category description	t	2026-09-20 07:55:08.92188	2026-09-20 07:55:08.951385
93a70be8-2c67-4f12-b56f-776cab19f756	CAT-20660	Test Category CAT-20660	Updated category description	t	2026-09-20 07:55:20.664471	2026-09-20 07:55:20.693056
53ba0eb2-068a-44c0-8a1c-05d1f95de466	CAT-49259	Test Category CAT-49259	Updated category description	t	2026-09-20 07:55:49.263502	2026-09-20 07:55:49.292126
49102afd-da26-493e-9ae5-b288e0a2127d	TABLETS	Tablets & iPads	Tablet devices and accessories	t	2026-09-20 10:04:16.895934	2026-09-20 10:04:16.895934
943a8787-3daa-42be-a1d0-fac189a31438	COMPUTER	Tablets & E-Readers	\N	t	2026-09-05 09:13:13.450853	2026-09-20 10:04:17.222664
\.


--
-- Data for Name: mails; Type: TABLE DATA; Schema: public; Owner: Vynn82
--

COPY public.mails (id, recipient_id, request_id, request_type, subject, message, action, request_url, is_read, created_at) FROM stdin;
c792f7c1-9494-4c0d-845a-b13ad36b2c73	693a56ed-5436-4756-ba32-ff09e691fbfd	bc07dfb3-41a4-4e10-9248-a2d8ffa02723	PRODUCT_CREATE	New PRODUCT_CREATE request requires your action	Request REQ-20260905-353628 has been submitted and is waiting for your action.	PENDING	/requests/bc07dfb3-41a4-4e10-9248-a2d8ffa02723	f	2026-09-05 14:46:52.306346
93b89a9e-bb7e-4abd-a382-14f5f64c0c86	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	d9caf790-9587-49e4-baf9-c7cccd172fa4	PRODUCT_CREATE	New PRODUCT_CREATE request requires your action	Request REQ-20260905-956618 is now waiting for your action.	PENDING	/requests/d9caf790-9587-49e4-baf9-c7cccd172fa4	f	2026-09-07 15:02:02.337969
45ecd5a0-4241-4470-8201-3c2d4e860600	693a56ed-5436-4756-ba32-ff09e691fbfd	c356d4f0-5780-4619-9675-89a6fc23dd60	PRODUCT_CREATE	New PRODUCT_CREATE request requires your action	Request REQ-20260907-689182 has been submitted and is waiting for your action.	PENDING	/requests/c356d4f0-5780-4619-9675-89a6fc23dd60	f	2026-09-07 15:36:41.142072
ecf57334-dc83-4095-ac8b-bd0e5edcc67e	1b5e9619-67e1-436a-b494-482acb94bffa	91d31cc4-bd53-4a6c-b6c3-1d30e5af54a0	PRODUCT_CREATE	PRODUCT_CREATE request created	Your request REQ-20260907-778669 has been created and is waiting for approval.	CREATED	/requests/91d31cc4-bd53-4a6c-b6c3-1d30e5af54a0	f	2026-09-07 15:56:55.653428
488467bc-127b-4431-bfb2-3c7c21458b49	693a56ed-5436-4756-ba32-ff09e691fbfd	91d31cc4-bd53-4a6c-b6c3-1d30e5af54a0	PRODUCT_CREATE	New PRODUCT_CREATE request requires your action	Request REQ-20260907-778669 has been submitted and is waiting for your action.	PENDING	/requests/91d31cc4-bd53-4a6c-b6c3-1d30e5af54a0	t	2026-09-07 15:56:55.645583
cd5ee1a6-c0a5-4740-bb27-6c0f5316c779	1b5e9619-67e1-436a-b494-482acb94bffa	91d31cc4-bd53-4a6c-b6c3-1d30e5af54a0	PRODUCT_CREATE	PRODUCT_CREATE request moved to next step	Request REQ-20260907-778669 has been certified by Ri Da and moved to step 2.	STEP_COMPLETED	/requests/91d31cc4-bd53-4a6c-b6c3-1d30e5af54a0	f	2026-09-07 16:01:34.451295
8b4678fd-55a2-4464-8e5d-f33cb978bde6	ba5249c1-bcd2-4647-9206-145a3f73c45c	91d31cc4-bd53-4a6c-b6c3-1d30e5af54a0	PRODUCT_CREATE	New PRODUCT_CREATE request requires your action	Request REQ-20260907-778669 is now waiting for your action.	PENDING	/requests/91d31cc4-bd53-4a6c-b6c3-1d30e5af54a0	t	2026-09-07 16:01:34.443461
f470c0ee-5c5f-424b-9d23-1e02b2544bdd	1b5e9619-67e1-436a-b494-482acb94bffa	91d31cc4-bd53-4a6c-b6c3-1d30e5af54a0	PRODUCT_CREATE	PRODUCT_CREATE request moved to next step	Request REQ-20260907-778669 has been certified by Ni Ta and moved to step 3.	STEP_COMPLETED	/requests/91d31cc4-bd53-4a6c-b6c3-1d30e5af54a0	f	2026-09-07 16:05:03.494691
c6f493e5-ef4e-4191-ad04-f73e5071c51f	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	91d31cc4-bd53-4a6c-b6c3-1d30e5af54a0	PRODUCT_CREATE	New PRODUCT_CREATE request requires your action	Request REQ-20260907-778669 is now waiting for your action.	PENDING	/requests/91d31cc4-bd53-4a6c-b6c3-1d30e5af54a0	t	2026-09-07 16:05:03.49007
2825200e-3e62-4547-b625-a8285b4df1b2	1b5e9619-67e1-436a-b494-482acb94bffa	91d31cc4-bd53-4a6c-b6c3-1d30e5af54a0	PRODUCT_CREATE	PRODUCT_CREATE request approved	Request REQ-20260907-778669 has been fully approved.	APPROVED	/requests/91d31cc4-bd53-4a6c-b6c3-1d30e5af54a0	f	2026-09-07 16:06:59.312274
b7ec9c8f-a564-4c9c-ac73-038b49ec0036	1b5e9619-67e1-436a-b494-482acb94bffa	34520eab-87eb-4b4d-848c-30cd2e2ad415	PRODUCT_CREATE	PRODUCT_CREATE request created	Your request REQ-20260909-546264 has been created and is waiting for approval.	CREATED	/requests/34520eab-87eb-4b4d-848c-30cd2e2ad415	f	2026-09-09 14:33:53.359822
9fc40664-3a51-4aa1-94de-98d50e853bcc	693a56ed-5436-4756-ba32-ff09e691fbfd	34520eab-87eb-4b4d-848c-30cd2e2ad415	PRODUCT_CREATE	New PRODUCT_CREATE request requires your action	Request REQ-20260909-546264 has been submitted and is waiting for your action.	PENDING	/requests/34520eab-87eb-4b4d-848c-30cd2e2ad415	t	2026-09-09 14:33:53.354056
111c2aa1-55c5-4bdb-ba4e-79ead6142bd1	1b5e9619-67e1-436a-b494-482acb94bffa	34520eab-87eb-4b4d-848c-30cd2e2ad415	PRODUCT_CREATE	PRODUCT_CREATE request moved to next step	Request REQ-20260909-546264 has been certified by Ri Da and moved to step 2.	STEP_COMPLETED	/requests/34520eab-87eb-4b4d-848c-30cd2e2ad415	f	2026-09-09 14:37:46.461892
4adb3e42-8293-431b-b6e9-fb7ac1d30370	ba5249c1-bcd2-4647-9206-145a3f73c45c	34520eab-87eb-4b4d-848c-30cd2e2ad415	PRODUCT_CREATE	New PRODUCT_CREATE request requires your action	Request REQ-20260909-546264 is now waiting for your action.	PENDING	/requests/34520eab-87eb-4b4d-848c-30cd2e2ad415	t	2026-09-09 14:37:46.453909
cad64644-a0c2-4ba8-98eb-96ddffadd9b5	1b5e9619-67e1-436a-b494-482acb94bffa	34520eab-87eb-4b4d-848c-30cd2e2ad415	PRODUCT_CREATE	PRODUCT_CREATE request moved to next step	Request REQ-20260909-546264 has been certified by Ni Ta and moved to step 3.	STEP_COMPLETED	/requests/34520eab-87eb-4b4d-848c-30cd2e2ad415	f	2026-09-09 14:38:20.370716
2fd7988c-5e6a-4582-8f7c-f914aa59e6ce	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	34520eab-87eb-4b4d-848c-30cd2e2ad415	PRODUCT_CREATE	New PRODUCT_CREATE request requires your action	Request REQ-20260909-546264 is now waiting for your action.	PENDING	/requests/34520eab-87eb-4b4d-848c-30cd2e2ad415	t	2026-09-09 14:38:20.367198
6a67664a-cf01-4598-a601-ef5883379767	1b5e9619-67e1-436a-b494-482acb94bffa	34520eab-87eb-4b4d-848c-30cd2e2ad415	PRODUCT_CREATE	Product request approved	Request REQ-20260909-546264 has been fully approved by System Administrator.	APPROVED	/requests/34520eab-87eb-4b4d-848c-30cd2e2ad415	f	2026-09-09 14:56:19.753046
8c79f8c8-612a-4693-b006-0df786c63725	693a56ed-5436-4756-ba32-ff09e691fbfd	d0d99013-911b-4eb7-a4b1-4476f77ddc22	STOCK_ADJUSTMENT	New STOCK_ADJUSTMENT request requires your action	Request REQ-20260920-492481 has been submitted and is waiting for your action.	PENDING	/requests/d0d99013-911b-4eb7-a4b1-4476f77ddc22	f	2026-09-20 08:29:37.859071
98b56321-8ac3-4293-9c17-30124a8a486d	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	d0d99013-911b-4eb7-a4b1-4476f77ddc22	STOCK_ADJUSTMENT	STOCK_ADJUSTMENT request created	Your request REQ-20260920-492481 has been created and is waiting for approval.	CREATED	/requests/d0d99013-911b-4eb7-a4b1-4476f77ddc22	f	2026-09-20 08:29:37.862867
b16a8f22-b577-4876-be77-05658fae23a1	693a56ed-5436-4756-ba32-ff09e691fbfd	6e1cd7b4-0a38-40c0-9ce5-64716f05ee40	STOCK_ADJUSTMENT	New STOCK_ADJUSTMENT request requires your action	Request REQ-20260920-375959 has been submitted and is waiting for your action.	PENDING	/requests/6e1cd7b4-0a38-40c0-9ce5-64716f05ee40	f	2026-09-20 08:31:14.585151
f6ab52b6-26be-4a39-a74b-436539f88248	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	6e1cd7b4-0a38-40c0-9ce5-64716f05ee40	STOCK_ADJUSTMENT	STOCK_ADJUSTMENT request created	Your request REQ-20260920-375959 has been created and is waiting for approval.	CREATED	/requests/6e1cd7b4-0a38-40c0-9ce5-64716f05ee40	f	2026-09-20 08:31:14.591365
94bbe92a-9e67-4da9-b4f2-9d59099fbc3c	693a56ed-5436-4756-ba32-ff09e691fbfd	ad8fdccb-a166-427d-adc2-ecc617e70212	STOCK_ADJUSTMENT	New STOCK_ADJUSTMENT request requires your action	Request REQ-20260920-665340 has been submitted and is waiting for your action.	PENDING	/requests/ad8fdccb-a166-427d-adc2-ecc617e70212	f	2026-09-20 08:31:14.622412
2482cdd4-cf04-4a8f-abf5-8860f590d905	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	ad8fdccb-a166-427d-adc2-ecc617e70212	STOCK_ADJUSTMENT	STOCK_ADJUSTMENT request created	Your request REQ-20260920-665340 has been created and is waiting for approval.	CREATED	/requests/ad8fdccb-a166-427d-adc2-ecc617e70212	f	2026-09-20 08:31:14.625187
25ee657d-ee07-4b74-83ed-6d18fd5a81f9	693a56ed-5436-4756-ba32-ff09e691fbfd	5429ae7c-5a1d-4dc4-85e1-ad79e734c449	STOCK_ADJUSTMENT	New STOCK_ADJUSTMENT request requires your action	Request REQ-20260920-851060 has been submitted and is waiting for your action.	PENDING	/requests/5429ae7c-5a1d-4dc4-85e1-ad79e734c449	f	2026-09-20 08:33:00.035547
42958476-5a84-4708-83b9-04856343f79f	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	5429ae7c-5a1d-4dc4-85e1-ad79e734c449	STOCK_ADJUSTMENT	STOCK_ADJUSTMENT request created	Your request REQ-20260920-851060 has been created and is waiting for approval.	CREATED	/requests/5429ae7c-5a1d-4dc4-85e1-ad79e734c449	f	2026-09-20 08:33:00.03908
fc1398e4-1669-41f4-862b-3fe974f8567c	693a56ed-5436-4756-ba32-ff09e691fbfd	22ba5fc8-e095-474e-bf0f-7aa421a8621d	STOCK_ADJUSTMENT	New STOCK_ADJUSTMENT request requires your action	Request REQ-20260920-279404 has been submitted and is waiting for your action.	PENDING	/requests/22ba5fc8-e095-474e-bf0f-7aa421a8621d	f	2026-09-20 08:33:31.040494
e7d44f60-2845-4671-962a-465faea517b8	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	22ba5fc8-e095-474e-bf0f-7aa421a8621d	STOCK_ADJUSTMENT	STOCK_ADJUSTMENT request created	Your request REQ-20260920-279404 has been created and is waiting for approval.	CREATED	/requests/22ba5fc8-e095-474e-bf0f-7aa421a8621d	f	2026-09-20 08:33:31.043794
7dc74391-329f-4db2-8b39-b4aec7d30b84	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	65c6da8b-27c6-41c6-82a7-37ba0309f57c	STOCK_ADJUSTMENT	STOCK_ADJUSTMENT request created	Your request REQ-20260920-561609 has been created and is waiting for approval.	CREATED	/requests/65c6da8b-27c6-41c6-82a7-37ba0309f57c	f	2026-09-20 08:34:12.452175
26327c7a-0531-465c-9d39-4d1b0615c938	693a56ed-5436-4756-ba32-ff09e691fbfd	65c6da8b-27c6-41c6-82a7-37ba0309f57c	STOCK_ADJUSTMENT	New STOCK_ADJUSTMENT request requires your action	Request REQ-20260920-561609 has been submitted and is waiting for your action.	PENDING	/requests/65c6da8b-27c6-41c6-82a7-37ba0309f57c	t	2026-09-20 08:34:12.449066
1443fe78-0703-4814-ab2f-75a7431d033c	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	65c6da8b-27c6-41c6-82a7-37ba0309f57c	STOCK_ADJUSTMENT	Product request approved	Request REQ-20260920-561609 has been fully approved by Ri Da.	APPROVED	/requests/65c6da8b-27c6-41c6-82a7-37ba0309f57c	f	2026-09-20 08:34:12.483513
a2f3ae0f-3a84-4932-b3da-e3385f402fcf	693a56ed-5436-4756-ba32-ff09e691fbfd	6fc4bf67-1139-456f-9779-6868b7b3ca99	STOCK_ADJUSTMENT	New STOCK_ADJUSTMENT request requires your action	Request REQ-20260920-243399 has been submitted and is waiting for your action.	PENDING	/requests/6fc4bf67-1139-456f-9779-6868b7b3ca99	f	2026-09-20 08:37:38.874716
ded83a2c-a922-40cf-b5f1-6b00755d5661	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	6fc4bf67-1139-456f-9779-6868b7b3ca99	STOCK_ADJUSTMENT	STOCK_ADJUSTMENT request created	Your request REQ-20260920-243399 has been created and is waiting for approval.	CREATED	/requests/6fc4bf67-1139-456f-9779-6868b7b3ca99	f	2026-09-20 08:37:38.880879
1c495339-3d41-4062-ada3-2f9eb7f6c765	693a56ed-5436-4756-ba32-ff09e691fbfd	caa64ea0-e792-4dd8-a143-45ed47227298	STOCK_ADJUSTMENT	New STOCK_ADJUSTMENT request requires your action	Request REQ-20260920-693719 has been submitted and is waiting for your action.	PENDING	/requests/caa64ea0-e792-4dd8-a143-45ed47227298	f	2026-09-20 08:37:38.911258
033569fe-093a-455b-9107-d6cf996e390e	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	caa64ea0-e792-4dd8-a143-45ed47227298	STOCK_ADJUSTMENT	STOCK_ADJUSTMENT request created	Your request REQ-20260920-693719 has been created and is waiting for approval.	CREATED	/requests/caa64ea0-e792-4dd8-a143-45ed47227298	f	2026-09-20 08:37:38.913672
3da6e27a-f807-417c-93b2-a6b9e9777a68	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	102ae3c3-ed37-4afe-85b2-32b6d1dedcdf	STOCK_ADJUSTMENT	STOCK_ADJUSTMENT request created	Your request REQ-20260920-451645 has been created and is waiting for approval.	CREATED	/requests/102ae3c3-ed37-4afe-85b2-32b6d1dedcdf	f	2026-09-20 08:37:55.459377
da309cda-0d56-4a9e-97f4-9c3dbb784f4b	693a56ed-5436-4756-ba32-ff09e691fbfd	102ae3c3-ed37-4afe-85b2-32b6d1dedcdf	STOCK_ADJUSTMENT	New STOCK_ADJUSTMENT request requires your action	Request REQ-20260920-451645 has been submitted and is waiting for your action.	PENDING	/requests/102ae3c3-ed37-4afe-85b2-32b6d1dedcdf	t	2026-09-20 08:37:55.456249
ecae68e3-5abf-4f93-9ac2-1c1ca4802f5c	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	102ae3c3-ed37-4afe-85b2-32b6d1dedcdf	STOCK_ADJUSTMENT	Product request approved	Request REQ-20260920-451645 has been fully approved by Ri Da.	APPROVED	/requests/102ae3c3-ed37-4afe-85b2-32b6d1dedcdf	f	2026-09-20 08:37:55.493487
2642ed3e-2f59-4f93-a1a9-75dc9e178a98	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	8dfa53fc-612c-4a03-b7da-f8aff69ad4cc	STOCK_ADJUSTMENT	STOCK_ADJUSTMENT request created	Your request REQ-20260920-957510 has been created and is waiting for approval.	CREATED	/requests/8dfa53fc-612c-4a03-b7da-f8aff69ad4cc	f	2026-09-20 08:37:55.512842
413413c8-13e0-435c-92d8-504403e5abda	693a56ed-5436-4756-ba32-ff09e691fbfd	8dfa53fc-612c-4a03-b7da-f8aff69ad4cc	STOCK_ADJUSTMENT	New STOCK_ADJUSTMENT request requires your action	Request REQ-20260920-957510 has been submitted and is waiting for your action.	PENDING	/requests/8dfa53fc-612c-4a03-b7da-f8aff69ad4cc	t	2026-09-20 08:37:55.510586
f91c5f3c-e186-4ef9-90f7-227664e2aedc	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	8dfa53fc-612c-4a03-b7da-f8aff69ad4cc	STOCK_ADJUSTMENT	Product request approved	Request REQ-20260920-957510 has been fully approved by Ri Da.	APPROVED	/requests/8dfa53fc-612c-4a03-b7da-f8aff69ad4cc	f	2026-09-20 08:37:55.539256
a7edff0d-c179-46ae-8fb8-8665e0e8c508	ba5249c1-bcd2-4647-9206-145a3f73c45c	f67c4089-45e2-4d03-83b4-495dfd1e06a3	PRODUCT_CREATE	New PRODUCT_CREATE request requires your action	Request REQ-20260920-542758 has been submitted and is waiting for your action.	PENDING	/requests/f67c4089-45e2-4d03-83b4-495dfd1e06a3	f	2026-09-20 11:05:35.649256
dc28fb4e-ce46-4009-a062-030ed72cd569	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	f67c4089-45e2-4d03-83b4-495dfd1e06a3	PRODUCT_CREATE	PRODUCT_CREATE request created	Your request REQ-20260920-542758 has been created and is waiting for approval.	CREATED	/requests/f67c4089-45e2-4d03-83b4-495dfd1e06a3	f	2026-09-20 11:05:35.653918
a7cc9ad6-00e8-4023-ad90-f56d097307c2	693a56ed-5436-4756-ba32-ff09e691fbfd	041f1000-5d61-4df7-aabf-bd05df03277e	PRODUCT_CREATE	New PRODUCT_CREATE request requires your action	Request REQ-20260920-441819 has been submitted and is waiting for your action.	PENDING	/requests/041f1000-5d61-4df7-aabf-bd05df03277e	f	2026-09-20 11:23:21.96963
005abbe8-16eb-4858-94c2-ea528a7fde94	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	041f1000-5d61-4df7-aabf-bd05df03277e	PRODUCT_CREATE	PRODUCT_CREATE request created	Your request REQ-20260920-441819 has been created and is waiting for approval.	CREATED	/requests/041f1000-5d61-4df7-aabf-bd05df03277e	f	2026-09-20 11:23:21.974072
\.


--
-- Data for Name: menus; Type: TABLE DATA; Schema: public; Owner: Vynn82
--

COPY public.menus (id, name, label, path, icon, parent_id, sort_order, is_active, is_system, created_at, updated_at) FROM stdin;
daaa3109-73ec-4280-8909-4fa626ca005f	DASHBOARD	Dashboard	/dashboard	LayoutDashboard	\N	1	t	t	2026-08-30 05:38:04.862912	2026-08-30 05:38:04.862912
ed980050-dc65-44ae-ac35-1c5ffa7eb8b5	INVENTORY	Inventory	\N	Warehouse	\N	2	t	t	2026-08-30 05:38:04.862912	2026-08-30 05:38:04.862912
09d38097-0108-42d6-8430-bbb6b7571fda	STAFF	Staff	/staff	Users	\N	3	t	t	2026-08-30 05:38:04.862912	2026-08-30 05:38:04.862912
f60a0579-a89f-4266-9a3b-f665bf65a5e2	ACCESS_CONTROL	Access Control	\N	Shield	\N	4	t	t	2026-08-30 05:38:04.862912	2026-08-30 05:38:04.862912
5d295f0c-bb9d-4c8d-a6f2-1705295353c2	PRODUCTS	Products	/products	Package	ed980050-dc65-44ae-ac35-1c5ffa7eb8b5	1	t	t	2026-08-30 05:38:04.862912	2026-08-30 05:38:04.862912
f8edb5d7-6cb7-4016-8959-53685bf92b37	STOCK	Stock	/stock	Boxes	ed980050-dc65-44ae-ac35-1c5ffa7eb8b5	2	t	t	2026-08-30 05:38:04.862912	2026-08-30 05:38:04.862912
a3eca3c2-8186-4f9f-8019-cd716ed47b56	WAREHOUSES	Warehouses	/warehouses	Building2	ed980050-dc65-44ae-ac35-1c5ffa7eb8b5	3	t	t	2026-08-30 05:38:04.862912	2026-08-30 05:38:04.862912
d5703203-0208-45b0-bc7d-88f1bb5368a0	ROLES	Roles	/roles	ShieldCheck	f60a0579-a89f-4266-9a3b-f665bf65a5e2	1	t	t	2026-08-30 05:38:04.862912	2026-08-30 05:38:04.862912
5eb484bf-5d49-465a-b1d0-e051236d2d76	PERMISSIONS	Permissions	/permissions	KeyRound	f60a0579-a89f-4266-9a3b-f665bf65a5e2	2	t	t	2026-08-30 05:38:04.862912	2026-08-30 05:38:04.862912
91179504-83c8-4d90-8985-0e67fc6bda35	DISCOUNTS	Discounts & Promos	/discounts	tag	\N	6	t	f	2026-09-20 10:04:15.864003	2026-09-20 10:04:15.864003
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: Vynn82
--

COPY public.migrations (id, "timestamp", name) FROM stdin;
1	1787499478939	CreateUsers1787499478939
2	1787500913412	CreateRoles1787500913412
3	1787501243465	CreatePermissions1787501243465
4	1787502082166	CreateUserRoles1787502082166
5	1787502927165	CreateRolePermissions1787502927165
6	1787581057953	RemoveRoleDescription1787581057953
7	1787581192329	RemoveDescriptions1787581192329
8	1787584576309	CreateSessions1787584576309
9	1788065144244	CreateMenus1788065144244
10	1788066000000	CreateRoleMenus1788066000000
11	178806	CreateCategories178806xxxxxxx
12	178806	CreateBrands178806xxxxxxx
13	178806	CreateSuppliers178806xxxxxxx
14	1788104163699	CreateWarehouses1788104163699
15	1788105000000	CreateProducts1788105000000
16	1788106000000	CreateProductVariants1788106000000
17	1788107000000	CreateRequests1788107000000
18	1788108000000	CreateApprovers1788108000000
19	1788363595846	AddImagesToRequestItems1788363595846
20	1788619452650	CreateMailsTable1788619452650
21	1788880862440	AddImageToProductVariants1788880862440
22	1788881189901	CreateStocksTable1788881189901
23	1788965543026	AddProductImage1788965543026
24	1788968044328	CreateStockAdjustments1788968044328
26	1788965543026	AddStockAdjustmentToRequestItems1788965543026
27	1788969998978	RenameReasonToAdjustmentReason1788969998978
28	1789000000000	MakeStockAdjustmentRequestIdNullable1789000000000
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: Vynn82
--

COPY public.permissions (id, name, description, resource, action, is_system, created_at, updated_at) FROM stdin;
ccee2c60-2ce0-4698-bfbd-ab70ef06b1d9	PRODUCT_CREATE	\N	product	create	t	2026-08-29 14:54:26.479439	2026-08-29 14:54:26.479439
7a12cdb1-f7e6-43a5-89f4-5b6ffe041e0f	PRODUCT_VIEW	\N	product	view	t	2026-08-29 14:54:26.479439	2026-08-29 14:54:26.479439
ac40bf3d-75c2-46f8-9e39-f95ee3448b3d	PRODUCT_UPDATE	\N	product	update	t	2026-08-29 14:54:26.479439	2026-08-29 14:54:26.479439
aab98279-1036-455a-b491-24caf4d55ebb	PRODUCT_DELETE	\N	product	delete	t	2026-08-29 14:54:26.479439	2026-08-29 14:54:26.479439
b9ee6475-b5bd-4ebd-8e24-2ffc6e2fc589	STAFF_CREATE	\N	staff	create	t	2026-08-29 14:54:26.479439	2026-08-29 14:54:26.479439
c4cebf9f-bf6b-493d-9f46-1ecc87d26a5f	STAFF_VIEW	\N	staff	view	t	2026-08-29 14:54:26.479439	2026-08-29 14:54:26.479439
23d46554-5d74-4e93-a708-fa52906f2c3c	STAFF_UPDATE	\N	staff	update	t	2026-08-29 14:54:26.479439	2026-08-29 14:54:26.479439
0005b580-9cad-4d80-bcbd-16f8bb050deb	STAFF_DELETE	\N	staff	delete	t	2026-08-29 14:54:26.479439	2026-08-29 14:54:26.479439
fc86fa76-4331-451b-86fc-a16a9087c8f7	ROLE_CREATE	\N	role	create	t	2026-08-29 14:54:26.479439	2026-08-29 14:54:26.479439
2b8bfd11-bb4d-460f-9093-15efd343077e	ROLE_VIEW	\N	role	view	t	2026-08-29 14:54:26.479439	2026-08-29 14:54:26.479439
3cba5d8e-8e23-4e53-8872-4b65c8716cb1	ROLE_UPDATE	\N	role	update	t	2026-08-29 14:54:26.479439	2026-08-29 14:54:26.479439
e303c4c8-4c7f-4d28-a6ce-a505175d2f9c	ROLE_DELETE	\N	role	delete	t	2026-08-29 14:54:26.479439	2026-08-29 14:54:26.479439
40ebc239-e267-48be-9e51-ac533a335463	PERMISSION_CREATE	\N	permission	create	t	2026-08-29 14:54:26.479439	2026-08-29 14:54:26.479439
044e1923-f4d6-4fd6-9c6b-cd2bcb7810f2	PERMISSION_VIEW	\N	permission	view	t	2026-08-29 14:54:26.479439	2026-08-29 14:54:26.479439
e0458e81-0b51-4b2a-94bb-c838ba803af5	PERMISSION_UPDATE	\N	permission	update	t	2026-08-29 14:54:26.479439	2026-08-29 14:54:26.479439
bbe55c78-8816-403c-a74d-8a4394b08e98	PERMISSION_DELETE	\N	permission	delete	t	2026-08-29 14:54:26.479439	2026-08-29 14:54:26.479439
dc14fb62-c603-4c56-8cc7-6ced3037f1e3	PRODUCT_APPROVE	\N	product	approve	t	2026-08-30 02:19:11.039513	2026-08-30 02:19:11.039513
bd65242a-8654-4713-a00b-3a1a57b0e14a	PRODUCT_CERTIFY	\N	product	certify	t	2026-08-30 02:19:20.854606	2026-08-30 02:19:20.854606
136853bf-8f17-4d78-bcfd-7b407f3f928c	MENU_VIEW	\N	menu	view	t	2026-08-30 04:56:41.414163	2026-08-30 04:56:41.414163
800d6266-66ac-4c0b-a45e-8e61c2a39a5e	MENU_CREATE	\N	menu	create	t	2026-08-30 04:56:41.414163	2026-08-30 04:56:41.414163
2e9ec304-aecb-462f-bdc4-8b4d6b8f17bc	MENU_UPDATE	\N	menu	update	t	2026-08-30 04:56:41.414163	2026-08-30 04:56:41.414163
16438e04-d4af-4129-b10e-007fee1b08c5	MENU_DELETE	\N	menu	delete	t	2026-08-30 04:56:41.414163	2026-08-30 04:56:41.414163
e6c23eee-3886-4443-85f1-12f0fd5f6a4e	REPORT_EXPORT	\N	report	export	t	2026-09-20 10:04:15.38838	2026-09-20 10:04:15.38838
aa50e1b4-2173-4ec1-99be-51ef9ef1d5da	ANALYTICS_VIEW	\N	analytics	view	t	2026-09-20 10:04:15.48017	2026-09-20 10:04:15.48017
3d902f32-86f4-4e36-8b25-feeebc04a175	ANALYTICS_EXPORT	\N	analytics	export	t	2026-09-20 10:04:15.48017	2026-09-20 10:04:15.48017
9a70352d-32d2-49f6-997c-9f9d65606355	DISCOUNT_VIEW	\N	discount	view	t	2026-09-20 10:04:15.587383	2026-09-20 10:04:15.587383
9fbb172d-95db-48bd-ba87-8cabd9348584	DISCOUNT_CREATE	\N	discount	create	t	2026-09-20 10:04:15.587383	2026-09-20 10:04:15.587383
7b1be0da-a9d8-44e1-8ccf-5ff83e1ee0a3	DISCOUNT_UPDATE	\N	discount	update	t	2026-09-20 10:04:15.587383	2026-09-20 10:04:15.587383
2ee26d26-48d5-43c0-b946-6062906e832e	DISCOUNT_DELETE	\N	discount	delete	t	2026-09-20 10:04:15.587383	2026-09-20 10:04:15.587383
\.


--
-- Data for Name: product_variants; Type: TABLE DATA; Schema: public; Owner: Vynn82
--

COPY public.product_variants (id, product_id, code, name, sku, barcode, attributes, cost_price, selling_price, is_active, created_at, updated_at, image) FROM stdin;
930c50ac-68ad-4bde-afca-a1bb0f25f9a6	a5dd6c7a-180f-4237-9473-aa3a7b8318e8	TEST-PROD-791489-V1	Variant 1 Red	SKU-791489-V1	BAR-V1-1489	{"Color": "Red"}	50.00	85.00	t	2026-09-20 07:53:11.495413	2026-09-20 07:53:11.495413	\N
1bc5044e-4766-4afd-a63d-00ff2f3bf41f	59b0d497-2b3b-4ff5-a93d-cf7438fc2f8f	PROD-883443-V1	Color Blue	SKU-883443-V1	BAR-V1-3443	{"Color": "Blue"}	60.00	99.00	t	2026-09-20 07:54:43.44795	2026-09-20 07:54:43.44795	\N
d338f707-f6d3-4947-9753-8e2ec26ed2b1	28b991ca-18ad-4f6a-b90b-3c78742edac3	PROD-909069-V1	Color Blue	SKU-909069-V1	BAR-V1-9069	{"Color": "Blue"}	60.00	99.00	t	2026-09-20 07:55:09.073145	2026-09-20 07:55:09.073145	\N
376cb188-8c8c-4045-9fc8-cd570e900276	5379de2b-36e1-43e2-9617-c670db5145f8	PROD-920807-V1	Color Blue	SKU-920807-V1	BAR-V1-0807	{"Color": "Blue"}	60.00	99.00	t	2026-09-20 07:55:20.811475	2026-09-20 07:55:20.811475	\N
c86d3632-78bb-479b-8535-07766e672c4e	36add03c-53a8-4e6f-ad6d-b43d56e6820a	PROD-949531-V1	Color Blue	SKU-949531-V1	BAR-V1-9531	{"Color": "Blue"}	60.00	99.00	t	2026-09-20 07:55:49.535261	2026-09-20 07:55:49.535261	\N
3e63fef1-dab1-43a7-b5b2-786dde4823a2	36add03c-53a8-4e6f-ad6d-b43d56e6820a	IP15-512-BLU	iPhone 15 512GB Blue	IP15-512-BLU	885909887766	{"Color": "Blue", "Storage": "512GB"}	950.00	1199.00	t	2026-09-20 10:34:39.494691	2026-09-20 10:34:39.494691	\N
41916d2d-b6d3-4d42-a549-be81cbc5a119	3bc3c30a-b8d6-4627-a1fc-911999d19c3a	VAR-DIR-1789902655016	Variant 1789902655016	VAR-SKU-1789902655016	\N	{"Color": "Silver"}	1500.00	2200.00	t	2026-09-20 11:10:55.024561	2026-09-20 11:10:55.024561	\N
63b46e7b-8d5e-4266-acf9-77c6663cb664	00e60628-471c-489d-b1d4-6107555228be	MBP16-M3-BLK	16" M3 Max Space Black 1TB	MBP16-M3-BLK-1TB	885909112240	{"RAM": "36GB", "Color": "Space Black", "Storage": "1TB"}	2800.00	3499.00	t	2026-09-20 11:16:18.060178	2026-09-20 11:16:18.060178	\N
b4aa37b8-4571-4477-8f1d-749bda871c8d	00e60628-471c-489d-b1d4-6107555228be	MBP16-M3-SLV	16" M3 Max Silver 1TB	MBP16-M3-SLV-1TB	885909112257	{"RAM": "36GB", "Color": "Silver", "Storage": "1TB"}	2800.00	3499.00	t	2026-09-20 11:16:18.060178	2026-09-20 11:16:18.060178	\N
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: Vynn82
--

COPY public.products (id, code, name, description, category_id, brand_id, supplier_id, has_variants, unit, barcode, sku, cost_price, selling_price, minimum_stock, maximum_stock, is_active, created_at, updated_at, image) FROM stdin;
a5dd6c7a-180f-4237-9473-aa3a7b8318e8	TEST-PROD-791489	Automated Test Product	Created during endpoint testing	943a8787-3daa-42be-a1d0-fac189a31438	de18960c-07a5-4225-9fe2-c94647b1e85c	\N	t	unit	BAR-791489	SKU-791489	50.00	85.00	5.000	100.000	t	2026-09-20 07:53:11.495413	2026-09-20 07:53:11.555902	\N
59b0d497-2b3b-4ff5-a93d-cf7438fc2f8f	PROD-883443	Direct E2E Test Product	Created during endpoint testing	56964f08-d6d9-40bd-907c-d148f6b3906b	45d98ac4-e88f-4c56-97d3-d4d1207289b5	e6fdb4e4-107a-43c9-955f-22ae3736ee26	t	box	BAR-883443	SKU-883443	60.00	99.00	5.000	150.000	t	2026-09-20 07:54:43.44795	2026-09-20 07:54:43.493248	\N
28b991ca-18ad-4f6a-b90b-3c78742edac3	PROD-909069	Direct E2E Test Product	Created during endpoint testing	60789a77-e4e2-411e-bdff-c27b0208c895	dfe8f826-ac1e-42ea-9200-14eec0573444	2c3541ac-68f7-4a52-885e-51a6d66a2dba	t	box	BAR-909069	SKU-909069	60.00	99.00	5.000	150.000	t	2026-09-20 07:55:09.073145	2026-09-20 07:55:09.114439	\N
5379de2b-36e1-43e2-9617-c670db5145f8	PROD-920807	Direct E2E Test Product	Created during endpoint testing	93a70be8-2c67-4f12-b56f-776cab19f756	d1b780ed-8b0e-4486-af9d-e87587f62233	0f688165-b0f5-48df-ac1a-0912a32f96b2	t	box	BAR-920807	SKU-920807	60.00	99.00	5.000	150.000	t	2026-09-20 07:55:20.811475	2026-09-20 07:55:20.856422	\N
6fb7376b-3b70-40e8-975c-524510dc95c5	IMP-PROD-49496	Excel Imported Product	Imported via test	53ba0eb2-068a-44c0-8a1c-05d1f95de466	fcbadba7-f9d2-4e65-8293-dfaeff6c32bc	9e977937-f74f-45fa-9d0f-9d39183910d4	f	pcs	BAR-949496	IMP-SKU-49496	40.00	70.00	5.000	50.000	t	2026-09-20 07:55:49.519326	2026-09-20 07:55:49.519326	\N
36add03c-53a8-4e6f-ad6d-b43d56e6820a	PROD-949531	Direct E2E Test Product	Created during endpoint testing	53ba0eb2-068a-44c0-8a1c-05d1f95de466	fcbadba7-f9d2-4e65-8293-dfaeff6c32bc	9e977937-f74f-45fa-9d0f-9d39183910d4	t	box	BAR-949531	SKU-949531	60.00	99.00	5.000	150.000	t	2026-09-20 07:55:49.535261	2026-09-20 07:55:49.576699	\N
3bc3c30a-b8d6-4627-a1fc-911999d19c3a	PROD-DIR-1789902655016	Direct Product 1789902655016	\N	943a8787-3daa-42be-a1d0-fac189a31438	de18960c-07a5-4225-9fe2-c94647b1e85c	305a8720-5262-4ffa-a08e-b609329b94d8	t	unit	\N	SKU-DIR-1789902655016	1500.00	2200.00	2.000	50.000	t	2026-09-20 11:10:55.024561	2026-09-20 11:10:55.024561	\N
00e60628-471c-489d-b1d4-6107555228be	MBP16-M3	MacBook Pro 16 M3 Max	\N	943a8787-3daa-42be-a1d0-fac189a31438	de18960c-07a5-4225-9fe2-c94647b1e85c	70a080d9-d1d7-424d-8273-5c21cf5f0256	t	unit	885909112233	MBP16-M3-MASTER	2800.00	3499.00	2.000	50.000	t	2026-09-20 11:16:18.060178	2026-09-20 11:16:18.060178	\N
\.


--
-- Data for Name: request_items; Type: TABLE DATA; Schema: public; Owner: Vynn82
--

COPY public.request_items (id, request_id, product_code, product_name, description, category_code, brand_code, supplier_code, has_variants, unit, product_sku, product_barcode, product_cost_price, product_selling_price, minimum_stock, maximum_stock, variant_code, variant_name, variant_sku, variant_barcode, variant_attributes, variant_cost_price, variant_selling_price, warehouse_code, quantity, from_warehouse_code, to_warehouse_code, created_at, updated_at, product_image, variant_image, adjustment_type, adjustment_reason) FROM stdin;
dee4a81d-c673-451e-9539-aed4d29b3f32	753a1540-46a7-4599-bbdd-66f523222859	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLK-128	Black / 128GB	IP15-BLK-128	\N	{"color": "Black", "storage": "128GB"}	700.00	799.00	WH001	50.000	\N	\N	2026-09-01 15:45:12.137209	2026-09-01 15:45:12.137209	\N	\N	\N	\N
29fc9dc3-1905-48a1-a0f7-9bf1612e0230	753a1540-46a7-4599-bbdd-66f523222859	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLU-256	Blue / 256GB	IP15-BLU-256	\N	{"color": "Blue", "storage": "256GB"}	780.00	899.00	WH001	30.000	\N	\N	2026-09-01 15:45:12.137209	2026-09-01 15:45:12.137209	\N	\N	\N	\N
556fd475-28ad-41ef-9a52-21f01126ce9b	753a1540-46a7-4599-bbdd-66f523222859	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-GRN-128	Green / 128GB	IP15-GRN-128	\N	{"color": "Green", "storage": "128GB"}	700.00	799.00	WH001	20.000	\N	\N	2026-09-01 15:45:12.137209	2026-09-01 15:45:12.137209	\N	\N	\N	\N
50bb7550-34f8-47da-895c-4adc3e03ec20	753a1540-46a7-4599-bbdd-66f523222859	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-WHT-512	White / 512GB	IP15-WHT-512	\N	{"color": "White", "storage": "512GB"}	900.00	999.00	WH001	10.000	\N	\N	2026-09-01 15:45:12.137209	2026-09-01 15:45:12.137209	\N	\N	\N	\N
8411643d-24a6-4c51-ab01-c7b113f410d9	bdd2f594-bdca-4bb9-8ec6-698c3cab73ba	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLK-128	Black / 128GB	IP15-BLK-128	\N	{"color": "Black", "storage": "128GB"}	700.00	799.00	WH001	50.000	\N	\N	2026-09-01 16:03:03.017062	2026-09-01 16:03:03.017062	\N	\N	\N	\N
8487c01c-4a5f-41d5-9b3d-fed075e8809d	bdd2f594-bdca-4bb9-8ec6-698c3cab73ba	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLU-256	Blue / 256GB	IP15-BLU-256	\N	{"color": "Blue", "storage": "256GB"}	780.00	899.00	WH001	30.000	\N	\N	2026-09-01 16:03:03.017062	2026-09-01 16:03:03.017062	\N	\N	\N	\N
87c6674f-9c88-4ce7-b670-6defaf7f6961	bdd2f594-bdca-4bb9-8ec6-698c3cab73ba	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-GRN-128	Green / 128GB	IP15-GRN-128	\N	{"color": "Green", "storage": "128GB"}	700.00	799.00	WH001	20.000	\N	\N	2026-09-01 16:03:03.017062	2026-09-01 16:03:03.017062	\N	\N	\N	\N
bcf198a6-4cd1-4ee5-b5b0-db0a2e19a32f	bdd2f594-bdca-4bb9-8ec6-698c3cab73ba	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-WHT-512	White / 512GB	IP15-WHT-512	\N	{"color": "White", "storage": "512GB"}	900.00	999.00	WH001	10.000	\N	\N	2026-09-01 16:03:03.017062	2026-09-01 16:03:03.017062	\N	\N	\N	\N
c89520c0-ee94-4c79-a39d-deea5e7a653f	e546907a-d54c-4669-b1c6-b61f8d3b3193	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLK-128	Black / 128GB	IP15-BLK-128	\N	\N	\N	\N	WH001	50.000	\N	\N	2026-09-01 16:05:02.657176	2026-09-01 16:05:02.657176	\N	\N	\N	\N
15677707-5c6a-4235-8cc6-443920aae5da	e546907a-d54c-4669-b1c6-b61f8d3b3193	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLU-256	Blue / 256GB	IP15-BLU-256	\N	\N	\N	\N	WH001	30.000	\N	\N	2026-09-01 16:05:02.657176	2026-09-01 16:05:02.657176	\N	\N	\N	\N
48622204-1316-4f10-9452-3cf97965769d	27a5cbc1-5d09-437a-8fdd-6525451c2a34	IP15P	iPhone 15 Pro	Apple iPhone 15 Pro Titanium	SMARTPHONE	APPLE	SUPP-APPLE-01	t	PCS	IP15P	194253000000	850.00	999.00	10.000	200.000	IP15P-NAT-128	Natural Titanium / 128GB	IP15P-NAT-128	194253111111	{"color": "Natural Titanium", "storage": "128GB"}	850.00	999.00	WH001	50.000	\N	\N	2026-09-01 16:26:11.713868	2026-09-01 16:26:11.713868	\N	\N	\N	\N
126de906-4255-4f9b-85b3-e37ba2717b04	27a5cbc1-5d09-437a-8fdd-6525451c2a34	IP15P	iPhone 15 Pro	Apple iPhone 15 Pro Titanium	SMARTPHONE	APPLE	SUPP-APPLE-01	t	PCS	IP15P	194253000000	850.00	999.00	10.000	200.000	IP15P-BLK-256	Black Titanium / 256GB	IP15P-BLK-256	194253222222	{"color": "Black Titanium", "storage": "256GB"}	950.00	1099.00	WH001	30.000	\N	\N	2026-09-01 16:26:11.713868	2026-09-01 16:26:11.713868	\N	\N	\N	\N
d0c9d8fa-c6cf-49da-9de2-9bb9f3023792	27a5cbc1-5d09-437a-8fdd-6525451c2a34	IP15P	iPhone 15 Pro	Apple iPhone 15 Pro Titanium	SMARTPHONE	APPLE	SUPP-APPLE-01	t	PCS	IP15P	194253000000	850.00	999.00	10.000	200.000	IP15P-WHT-512	White Titanium / 512GB	IP15P-WHT-512	194253333333	{"color": "White Titanium", "storage": "512GB"}	1150.00	1299.00	WH001	20.000	\N	\N	2026-09-01 16:26:11.713868	2026-09-01 16:26:11.713868	\N	\N	\N	\N
3952842e-c3f7-47e3-a5a6-d9472f217323	8843fcad-9f54-40e9-9309-b3ae7578e569	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLK-128	Black / 128GB	IP15-BLK-128	\N	\N	\N	\N	WH001	50.000	\N	\N	2026-09-02 16:40:02.254898	2026-09-02 16:40:02.254898	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788367201/stock-management/products/qmvgjnijm4b9foweewab.jpg	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788367200/stock-management/products/yypydai6s2wueghf1vbb.jpg	\N	\N
296548a7-bd8e-4f9c-b219-a3c1201bba11	8843fcad-9f54-40e9-9309-b3ae7578e569	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLU-256	Blue / 256GB	IP15-BLU-256	\N	\N	\N	\N	WH001	30.000	\N	\N	2026-09-02 16:40:02.254898	2026-09-02 16:40:02.254898	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788367201/stock-management/products/qmvgjnijm4b9foweewab.jpg	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788367201/stock-management/products/g3kzhakaxpd2l6ptoxoo.jpg	\N	\N
8dfccd94-9606-4f5d-8057-c72407a4d7d9	c813ed08-981f-489c-b8d4-32049e49dfe7	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLK-128	Black / 128GB	IP15-BLK-128	\N	\N	\N	\N	WH001	50.000	\N	\N	2026-09-02 16:46:36.163867	2026-09-02 16:46:36.163867	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788367594/stock-management/products/gjeyc5muws5px4k1do7w.jpg	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788367595/stock-management/products/jfguncbaloaf0im5f4to.jpg	\N	\N
af22a5a2-65ba-4a2a-9069-10dfc5abbe8c	c813ed08-981f-489c-b8d4-32049e49dfe7	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLU-256	Blue / 256GB	IP15-BLU-256	\N	\N	\N	\N	WH001	30.000	\N	\N	2026-09-02 16:46:36.163867	2026-09-02 16:46:36.163867	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788367594/stock-management/products/gjeyc5muws5px4k1do7w.jpg	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788367595/stock-management/products/ithnko0dsydgrwgijhdy.jpg	\N	\N
e6edb8aa-e38f-443f-8ae6-728bba1a0d1e	f67c4089-45e2-4d03-83b4-495dfd1e06a3	MBP16-T-1789902335624	MacBook Pro 16 Test	\N	COMPUTER	APPLE	TECH-HUB-ASIA	t	unit	SKU-1789902335624	\N	2000.00	3000.00	2.000	50.000	MBP16-BLK-1789902335624	Space Black	VAR-SKU-1789902335624	\N	{"Color": "Black"}	2000.00	3000.00	WH001	10.000	\N	\N	2026-09-20 11:05:35.631814	2026-09-20 11:05:35.631814	\N	\N	\N	\N
9e62dcca-47d4-4ec5-93e8-d9ed2ac7b743	5b6b75f3-fed1-4c68-aedf-e4a41aabcba3	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLK-128	Black / 128GB	IP15-BLK-128	\N	\N	\N	\N	WH001	50.000	\N	\N	2026-09-04 16:39:51.774932	2026-09-04 16:39:51.774932	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788539991/stock-management/products/hsx8eqybdptnuas7rkc2.jpg	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788539991/stock-management/products/nyuzch62jufwk85capx4.jpg	\N	\N
af6f712d-7c94-45f2-938e-748fd3a8954d	5b6b75f3-fed1-4c68-aedf-e4a41aabcba3	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLU-256	Blue / 256GB	IP15-BLU-256	\N	\N	\N	\N	WH001	30.000	\N	\N	2026-09-04 16:39:51.774932	2026-09-04 16:39:51.774932	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788539991/stock-management/products/hsx8eqybdptnuas7rkc2.jpg	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788539991/stock-management/products/zmwleoo6nl7kjzgwidvv.jpg	\N	\N
a0ae8de2-41e2-4ce7-95da-83c1d88db391	717b60c1-d5b4-417b-8f83-dc4777333d3e	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLK-128	Black / 128GB	IP15-BLK-128	\N	\N	\N	\N	WH001	50.000	\N	\N	2026-09-04 16:55:30.189968	2026-09-04 16:55:30.189968	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788540929/stock-management/products/wizh6womqoxdeuc85gao.jpg	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788540929/stock-management/products/nqg5k9prmlbeyjhsqhqm.jpg	\N	\N
40fde2ae-60da-4926-b1b4-ed6de656d5fd	717b60c1-d5b4-417b-8f83-dc4777333d3e	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLU-256	Blue / 256GB	IP15-BLU-256	\N	\N	\N	\N	WH001	30.000	\N	\N	2026-09-04 16:55:30.189968	2026-09-04 16:55:30.189968	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788540929/stock-management/products/wizh6womqoxdeuc85gao.jpg	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788540929/stock-management/products/jfzdapqgvwgytsodfbi2.jpg	\N	\N
64c48afe-4656-44cd-885f-ec2691473c58	d9caf790-9587-49e4-baf9-c7cccd172fa4	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLK-128	Black / 128GB	IP15-BLK-128	\N	\N	\N	\N	WH001	50.000	\N	\N	2026-09-05 14:28:26.141553	2026-09-05 14:28:26.141553	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788618505/stock-management/products/lzj65nyiotk3yd0pk3hl.jpg	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788618505/stock-management/products/qod31yociefh3w5jf35q.jpg	\N	\N
dac231c1-8646-44b1-8179-20d40afc8c77	d9caf790-9587-49e4-baf9-c7cccd172fa4	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLU-256	Blue / 256GB	IP15-BLU-256	\N	\N	\N	\N	WH001	30.000	\N	\N	2026-09-05 14:28:26.141553	2026-09-05 14:28:26.141553	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788618505/stock-management/products/lzj65nyiotk3yd0pk3hl.jpg	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788618505/stock-management/products/n6tfoyh4mulrmigiwqih.jpg	\N	\N
b6bfae5e-09e4-41a8-ac18-2b0d25284cbd	5c548293-3e02-4bef-866b-0a3bfde93617	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLK-128	Black / 128GB	IP15-BLK-128	\N	\N	\N	\N	WH001	50.000	\N	\N	2026-09-05 14:33:52.172104	2026-09-05 14:33:52.172104	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788618831/stock-management/products/nh0vhiwrnvfexpo7oeqw.jpg	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788618831/stock-management/products/ryt1wxdlse0l91ey6vve.jpg	\N	\N
4431f14c-b6b3-4474-b387-136eac418e63	5c548293-3e02-4bef-866b-0a3bfde93617	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLU-256	Blue / 256GB	IP15-BLU-256	\N	\N	\N	\N	WH001	30.000	\N	\N	2026-09-05 14:33:52.172104	2026-09-05 14:33:52.172104	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788618831/stock-management/products/nh0vhiwrnvfexpo7oeqw.jpg	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788618831/stock-management/products/uvhjipy74hvkls4uzkds.jpg	\N	\N
97ab3a7a-227a-4dd8-a82f-6f1764f9b236	bc07dfb3-41a4-4e10-9248-a2d8ffa02723	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLK-128	Black / 128GB	IP15-BLK-128	\N	\N	\N	\N	WH001	50.000	\N	\N	2026-09-05 14:46:52.268774	2026-09-05 14:46:52.268774	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788619611/stock-management/products/h04wdsowq8weap3je7r1.jpg	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788619611/stock-management/products/d0fvfhxlj6tdf0uuyv7q.jpg	\N	\N
93d5ce72-e3d9-4c27-8959-db8b9aef741c	bc07dfb3-41a4-4e10-9248-a2d8ffa02723	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLU-256	Blue / 256GB	IP15-BLU-256	\N	\N	\N	\N	WH001	30.000	\N	\N	2026-09-05 14:46:52.268774	2026-09-05 14:46:52.268774	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788619611/stock-management/products/h04wdsowq8weap3je7r1.jpg	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788619611/stock-management/products/bdi9dqmjdxiya46fdnrb.jpg	\N	\N
f4d160d3-c950-47a9-b13e-cde0166d5d02	c356d4f0-5780-4619-9675-89a6fc23dd60	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLK-128	Black / 128GB	IP15-BLK-128	\N	\N	\N	\N	WH001	50.000	\N	\N	2026-09-07 15:36:41.107358	2026-09-07 15:36:41.107358	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788795399/stock-management/products/e7bazkgm2xauzffkvwzu.jpg	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788795399/stock-management/products/jpckmizmm6sqgulaemzd.jpg	\N	\N
d6eba418-dff3-491c-a5a4-0b236b6e93c8	c356d4f0-5780-4619-9675-89a6fc23dd60	IP15	iPhone 15	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLU-256	Blue / 256GB	IP15-BLU-256	\N	\N	\N	\N	WH001	30.000	\N	\N	2026-09-07 15:36:41.107358	2026-09-07 15:36:41.107358	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788795399/stock-management/products/e7bazkgm2xauzffkvwzu.jpg	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788795400/stock-management/products/gb6iefeqvgcalnhgsvlp.jpg	\N	\N
03618c39-45c9-43d1-94de-89885b2227da	91d31cc4-bd53-4a6c-b6c3-1d30e5af54a0	IP15	iPhone 15 KILO ZIN	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLK-128	Black / 128GB	IP15-BLK-128	\N	\N	\N	\N	WH001	50.000	\N	\N	2026-09-07 15:56:55.60834	2026-09-07 15:56:55.60834	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788796614/stock-management/products/owbzilcknkx2kv8f2ufc.jpg	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788796613/stock-management/products/zc6ssu8oduamsdrfmudm.jpg	\N	\N
cbba8cee-e8b6-41b0-aef3-f77b9c6e7815	91d31cc4-bd53-4a6c-b6c3-1d30e5af54a0	IP15	iPhone 15 KILO ZIN	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLU-256	Blue / 256GB	IP15-BLU-256	\N	\N	\N	\N	WH001	30.000	\N	\N	2026-09-07 15:56:55.60834	2026-09-07 15:56:55.60834	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788796614/stock-management/products/owbzilcknkx2kv8f2ufc.jpg	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788796614/stock-management/products/jaqtsvmrpu2kkiqvh2gf.jpg	\N	\N
0a5a241c-5395-4ecd-859c-e193143aff0a	34520eab-87eb-4b4d-848c-30cd2e2ad415	IP15	iPhone 15 KILO ZIN	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLK-128	Black / 128GB	IP15-BLK-128	\N	\N	\N	\N	WH001	50.000	\N	\N	2026-09-09 14:33:53.303513	2026-09-09 14:33:53.303513	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788964432/stock-management/products/ivse3lfgqck0fdhmgvs5.jpg	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788964432/stock-management/products/ggi2jtpcfyxqr2px2df9.jpg	\N	\N
1636211b-2ff4-4202-8f40-4d307883449f	34520eab-87eb-4b4d-848c-30cd2e2ad415	IP15	iPhone 15 KILO ZIN	\N	SMARTPHONE	APPLE	\N	t	PCS	IP15	\N	\N	\N	\N	\N	IP15-BLU-256	Blue / 256GB	IP15-BLU-256	\N	\N	\N	\N	WH001	30.000	\N	\N	2026-09-09 14:33:53.303513	2026-09-09 14:33:53.303513	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788964432/stock-management/products/ivse3lfgqck0fdhmgvs5.jpg	https://res.cloudinary.com/dlob9mwy3/image/upload/v1788964432/stock-management/products/n3olsaioch4azdhizojy.jpg	\N	\N
e5ac1b6d-6abf-42bd-bbe5-08211a4e87ff	d0d99013-911b-4eb7-a4b1-4476f77ddc22	PROD-949531		\N		\N	\N	f			\N	50.00	80.00	\N	\N	\N	\N	\N	\N	\N	50.00	80.00	WH001	1.000	\N	\N	2026-09-20 08:29:37.837704	2026-09-20 08:29:37.837704	\N	\N	DECREASE	Damaged during inspection
1abcd7fc-d12d-46ae-8ffc-3a48e0f5cd25	d0d99013-911b-4eb7-a4b1-4476f77ddc22	PROD-949531		\N		\N	\N	f			\N	50.00	80.00	\N	\N	\N	\N	\N	\N	\N	50.00	80.00	WH001	2.000	\N	\N	2026-09-20 08:29:37.837704	2026-09-20 08:29:37.837704	\N	\N	INCREASE	Found extra during inventory check
ac079074-2b44-45f6-bda6-f84057635bed	6e1cd7b4-0a38-40c0-9ce5-64716f05ee40	PROD-949531		\N		\N	\N	f			\N	50.00	80.00	\N	\N	\N	\N	\N	\N	\N	50.00	80.00	WH001	1.000	\N	\N	2026-09-20 08:31:14.566599	2026-09-20 08:31:14.566599	\N	\N	DECREASE	Damaged during inspection
2f5e1f32-b4fd-4b5e-b9b8-3a1611192f33	6e1cd7b4-0a38-40c0-9ce5-64716f05ee40	PROD-949531		\N		\N	\N	f			\N	50.00	80.00	\N	\N	\N	\N	\N	\N	\N	50.00	80.00	WH001	2.000	\N	\N	2026-09-20 08:31:14.566599	2026-09-20 08:31:14.566599	\N	\N	INCREASE	Found extra during inventory check
80ab6efe-ce0e-4003-8597-901a45c4a09c	ad8fdccb-a166-427d-adc2-ecc617e70212	PROD-949531		\N		\N	\N	f			\N	50.00	80.00	\N	\N	\N	\N	\N	\N	\N	50.00	80.00	WH001	2.000	\N	\N	2026-09-20 08:31:14.614911	2026-09-20 08:31:14.614911	\N	\N	DECREASE	Lost in warehouse (negative quantity)
53e99def-5a32-401f-a897-48f0255cc46c	ad8fdccb-a166-427d-adc2-ecc617e70212	PROD-949531		\N		\N	\N	f			\N	50.00	80.00	\N	\N	\N	\N	\N	\N	\N	50.00	80.00	WH001	3.000	\N	\N	2026-09-20 08:31:14.614911	2026-09-20 08:31:14.614911	\N	\N	INCREASE	Audit surplus (positive quantity)
a38abc70-e201-48d1-9342-1daea5f60cdf	5429ae7c-5a1d-4dc4-85e1-ad79e734c449	PROD-949531		\N		\N	\N	f			\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	WH001	5.000	\N	\N	2026-09-20 08:33:00.01719	2026-09-20 08:33:00.01719	\N	\N	INCREASE	Manual stock addition test
823956f7-9be3-497c-8709-f538a701d528	22ba5fc8-e095-474e-bf0f-7aa421a8621d	TEST-PROD-791489		\N		\N	\N	f			\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	WH001	5.000	\N	\N	2026-09-20 08:33:31.025722	2026-09-20 08:33:31.025722	\N	\N	DECREASE	Damaged item deduction
fd6f21df-b294-45bc-b3a2-9e9bbb8d581f	65c6da8b-27c6-41c6-82a7-37ba0309f57c	IMP-PROD-49496		\N		\N	\N	f			\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	WH-49364	5.000	\N	\N	2026-09-20 08:34:12.435382	2026-09-20 08:34:12.435382	\N	\N	INCREASE	Manual stock addition test
f42dac23-c1c2-4d57-b278-ccb7bfe07df9	6fc4bf67-1139-456f-9779-6868b7b3ca99	PROD-949531		\N		\N	\N	f			\N	50.00	80.00	\N	\N	\N	\N	\N	\N	\N	50.00	80.00	WH001	1.000	\N	\N	2026-09-20 08:37:38.856694	2026-09-20 08:37:38.856694	\N	\N	DECREASE	Damaged during inspection
be127ecd-477d-470e-ae32-cd32c24833b5	6fc4bf67-1139-456f-9779-6868b7b3ca99	PROD-949531		\N		\N	\N	f			\N	50.00	80.00	\N	\N	\N	\N	\N	\N	\N	50.00	80.00	WH001	2.000	\N	\N	2026-09-20 08:37:38.856694	2026-09-20 08:37:38.856694	\N	\N	INCREASE	Found extra during inventory check
58c28810-21e7-4838-9840-aa8dd09a6430	caa64ea0-e792-4dd8-a143-45ed47227298	PROD-949531		\N		\N	\N	f			\N	50.00	80.00	\N	\N	\N	\N	\N	\N	\N	50.00	80.00	WH001	2.000	\N	\N	2026-09-20 08:37:38.903025	2026-09-20 08:37:38.903025	\N	\N	DECREASE	Lost in warehouse (negative quantity)
f99ecec8-d771-4263-8f48-a859b4de05d6	caa64ea0-e792-4dd8-a143-45ed47227298	PROD-949531		\N		\N	\N	f			\N	50.00	80.00	\N	\N	\N	\N	\N	\N	\N	50.00	80.00	WH001	3.000	\N	\N	2026-09-20 08:37:38.903025	2026-09-20 08:37:38.903025	\N	\N	INCREASE	Audit surplus (positive quantity)
b2ae541f-8e3f-4048-8df6-d6a36a95defd	102ae3c3-ed37-4afe-85b2-32b6d1dedcdf	IMP-PROD-49496		\N		\N	\N	f			\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	WH-49364	3.000	\N	\N	2026-09-20 08:37:55.44252	2026-09-20 08:37:55.44252	\N	\N	DECREASE	Expired inventory test
928ced0b-0869-4375-b68a-429e76a60a48	8dfa53fc-612c-4a03-b7da-f8aff69ad4cc	IMP-PROD-49496		\N		\N	\N	f			\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	WH-49364	2.000	\N	\N	2026-09-20 08:37:55.504545	2026-09-20 08:37:55.504545	\N	\N	DECREASE	Lost inventory test
ebeb84ed-49bf-4905-aa9d-61719ac64a65	041f1000-5d61-4df7-aabf-bd05df03277e	IPHONE-16-PLUS	iPhone 16 Plus	\N	SMARTPHONE	APPLE	\N	f	unit	IP16P-BASE	\N	799.00	999.00	5.000	100.000	\N	\N	\N	\N	\N	\N	\N	WH001	20.000	\N	\N	2026-09-20 11:23:21.949434	2026-09-20 11:23:21.949434	https://res.cloudinary.com/dlob9mwy3/image/upload/v1789903401/stock-management/products/d9p1a1i1hy3jgzy5fezh.jpg	\N	\N	\N
\.


--
-- Data for Name: requests; Type: TABLE DATA; Schema: public; Owner: Vynn82
--

COPY public.requests (id, request_no, requester_id, request_type, source, status, current_step, remark, created_at, updated_at) FROM stdin;
753a1540-46a7-4599-bbdd-66f523222859	REQ-20260901-856533	693a56ed-5436-4756-ba32-ff09e691fbfd	PRODUCT_CREATE	MANUAL	PENDING	1	\N	2026-09-01 15:45:12.137209	2026-09-01 15:45:12.137209
bdd2f594-bdca-4bb9-8ec6-698c3cab73ba	REQ-20260901-242046	693a56ed-5436-4756-ba32-ff09e691fbfd	PRODUCT_CREATE	MANUAL	PENDING	1	\N	2026-09-01 16:03:03.017062	2026-09-01 16:03:03.017062
e546907a-d54c-4669-b1c6-b61f8d3b3193	REQ-20260901-218421	693a56ed-5436-4756-ba32-ff09e691fbfd	PRODUCT_CREATE	MANUAL	PENDING	1	\N	2026-09-01 16:05:02.657176	2026-09-01 16:05:02.657176
27a5cbc1-5d09-437a-8fdd-6525451c2a34	REQ-20260901-270423	693a56ed-5436-4756-ba32-ff09e691fbfd	PRODUCT_CREATE	EXCEL	PENDING	1	\N	2026-09-01 16:26:11.713868	2026-09-01 16:26:11.713868
8843fcad-9f54-40e9-9309-b3ae7578e569	REQ-20260902-584689	693a56ed-5436-4756-ba32-ff09e691fbfd	PRODUCT_CREATE	MANUAL	PENDING	1	\N	2026-09-02 16:40:02.254898	2026-09-02 16:40:02.254898
c813ed08-981f-489c-b8d4-32049e49dfe7	REQ-20260902-695339	693a56ed-5436-4756-ba32-ff09e691fbfd	PRODUCT_CREATE	MANUAL	PENDING	1	\N	2026-09-02 16:46:36.163867	2026-09-02 16:46:36.163867
5b6b75f3-fed1-4c68-aedf-e4a41aabcba3	REQ-20260904-513796	1b5e9619-67e1-436a-b494-482acb94bffa	PRODUCT_CREATE	MANUAL	PENDING	1	\N	2026-09-04 16:39:51.774932	2026-09-04 16:39:51.774932
717b60c1-d5b4-417b-8f83-dc4777333d3e	REQ-20260904-466832	1b5e9619-67e1-436a-b494-482acb94bffa	PRODUCT_CREATE	MANUAL	PENDING	2	\N	2026-09-04 16:55:30.189968	2026-09-04 17:06:24.246106
5c548293-3e02-4bef-866b-0a3bfde93617	REQ-20260905-863150	1b5e9619-67e1-436a-b494-482acb94bffa	PRODUCT_CREATE	MANUAL	PENDING	1	\N	2026-09-05 14:33:52.172104	2026-09-05 14:33:52.172104
bc07dfb3-41a4-4e10-9248-a2d8ffa02723	REQ-20260905-353628	1b5e9619-67e1-436a-b494-482acb94bffa	PRODUCT_CREATE	MANUAL	PENDING	1	\N	2026-09-05 14:46:52.268774	2026-09-05 14:46:52.268774
d9caf790-9587-49e4-baf9-c7cccd172fa4	REQ-20260905-956618	1b5e9619-67e1-436a-b494-482acb94bffa	PRODUCT_CREATE	MANUAL	APPROVED	3	\N	2026-09-05 14:28:26.141553	2026-09-07 15:08:11.615803
c356d4f0-5780-4619-9675-89a6fc23dd60	REQ-20260907-689182	1b5e9619-67e1-436a-b494-482acb94bffa	PRODUCT_CREATE	MANUAL	PENDING	1	\N	2026-09-07 15:36:41.107358	2026-09-07 15:36:41.107358
f67c4089-45e2-4d03-83b4-495dfd1e06a3	REQ-20260920-542758	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	PRODUCT_CREATE	MANUAL	PENDING	1	Test creation with valid approvers	2026-09-20 11:05:35.631814	2026-09-20 11:05:35.631814
91d31cc4-bd53-4a6c-b6c3-1d30e5af54a0	REQ-20260907-778669	1b5e9619-67e1-436a-b494-482acb94bffa	PRODUCT_CREATE	MANUAL	APPROVED	3	\N	2026-09-07 15:56:55.60834	2026-09-07 16:06:59.282075
041f1000-5d61-4df7-aabf-bd05df03277e	REQ-20260920-441819	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	PRODUCT_CREATE	MANUAL	PENDING	1	Single product launch without variants	2026-09-20 11:23:21.949434	2026-09-20 11:23:21.949434
34520eab-87eb-4b4d-848c-30cd2e2ad415	REQ-20260909-546264	1b5e9619-67e1-436a-b494-482acb94bffa	PRODUCT_CREATE	MANUAL	APPROVED	3	\N	2026-09-09 14:33:53.303513	2026-09-09 14:56:19.665555
d0d99013-911b-4eb7-a4b1-4476f77ddc22	REQ-20260920-492481	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	STOCK_ADJUSTMENT	EXCEL	PENDING	1	\N	2026-09-20 08:29:37.837704	2026-09-20 08:29:37.837704
6e1cd7b4-0a38-40c0-9ce5-64716f05ee40	REQ-20260920-375959	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	STOCK_ADJUSTMENT	EXCEL	PENDING	1	\N	2026-09-20 08:31:14.566599	2026-09-20 08:31:14.566599
ad8fdccb-a166-427d-adc2-ecc617e70212	REQ-20260920-665340	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	STOCK_ADJUSTMENT	EXCEL	PENDING	1	\N	2026-09-20 08:31:14.614911	2026-09-20 08:31:14.614911
5429ae7c-5a1d-4dc4-85e1-ad79e734c449	REQ-20260920-851060	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	STOCK_ADJUSTMENT	MANUAL	PENDING	1	\N	2026-09-20 08:33:00.01719	2026-09-20 08:33:00.01719
22ba5fc8-e095-474e-bf0f-7aa421a8621d	REQ-20260920-279404	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	STOCK_ADJUSTMENT	MANUAL	PENDING	1	\N	2026-09-20 08:33:31.025722	2026-09-20 08:33:31.025722
65c6da8b-27c6-41c6-82a7-37ba0309f57c	REQ-20260920-561609	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	STOCK_ADJUSTMENT	MANUAL	APPROVED	1	\N	2026-09-20 08:34:12.435382	2026-09-20 08:34:12.459914
6fc4bf67-1139-456f-9779-6868b7b3ca99	REQ-20260920-243399	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	STOCK_ADJUSTMENT	EXCEL	PENDING	1	\N	2026-09-20 08:37:38.856694	2026-09-20 08:37:38.856694
caa64ea0-e792-4dd8-a143-45ed47227298	REQ-20260920-693719	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	STOCK_ADJUSTMENT	EXCEL	PENDING	1	\N	2026-09-20 08:37:38.903025	2026-09-20 08:37:38.903025
102ae3c3-ed37-4afe-85b2-32b6d1dedcdf	REQ-20260920-451645	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	STOCK_ADJUSTMENT	EXCEL	APPROVED	1	\N	2026-09-20 08:37:55.44252	2026-09-20 08:37:55.467319
8dfa53fc-612c-4a03-b7da-f8aff69ad4cc	REQ-20260920-957510	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	STOCK_ADJUSTMENT	EXCEL	APPROVED	1	\N	2026-09-20 08:37:55.504545	2026-09-20 08:37:55.520085
\.


--
-- Data for Name: role_menus; Type: TABLE DATA; Schema: public; Owner: Vynn82
--

COPY public.role_menus (id, role_id, menu_id) FROM stdin;
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: Vynn82
--

COPY public.role_permissions (id, role_id, permission_id) FROM stdin;
9c98fe15-ddda-48dc-b870-419e523bc5a0	177b15c4-ff66-4ac5-b854-3d8ac47d57ba	ccee2c60-2ce0-4698-bfbd-ab70ef06b1d9
e001be26-555a-45a1-962c-0108b5dc753a	177b15c4-ff66-4ac5-b854-3d8ac47d57ba	7a12cdb1-f7e6-43a5-89f4-5b6ffe041e0f
1b33f659-6ba5-43d6-a8b6-965024ce7b73	177b15c4-ff66-4ac5-b854-3d8ac47d57ba	ac40bf3d-75c2-46f8-9e39-f95ee3448b3d
c4611a7e-ed61-4c3b-b2bd-b6d82ca6dad5	177b15c4-ff66-4ac5-b854-3d8ac47d57ba	aab98279-1036-455a-b491-24caf4d55ebb
eff75298-e976-4489-ac09-95d7013b1f43	177b15c4-ff66-4ac5-b854-3d8ac47d57ba	b9ee6475-b5bd-4ebd-8e24-2ffc6e2fc589
afdb6cc2-b43a-423c-8055-7c81da64448e	177b15c4-ff66-4ac5-b854-3d8ac47d57ba	c4cebf9f-bf6b-493d-9f46-1ecc87d26a5f
90408a28-bccb-42a1-8876-345b3b96bd57	177b15c4-ff66-4ac5-b854-3d8ac47d57ba	23d46554-5d74-4e93-a708-fa52906f2c3c
a54102c3-e611-4448-bf18-9ecf469f80c8	177b15c4-ff66-4ac5-b854-3d8ac47d57ba	0005b580-9cad-4d80-bcbd-16f8bb050deb
142d8a32-23d5-41fd-a44c-1d41d3c0f640	177b15c4-ff66-4ac5-b854-3d8ac47d57ba	fc86fa76-4331-451b-86fc-a16a9087c8f7
6a64ce60-e7fd-4131-a5b1-402d5ef4d6e3	177b15c4-ff66-4ac5-b854-3d8ac47d57ba	2b8bfd11-bb4d-460f-9093-15efd343077e
058c60f0-068f-46d8-9b47-2876b1ca23b1	177b15c4-ff66-4ac5-b854-3d8ac47d57ba	3cba5d8e-8e23-4e53-8872-4b65c8716cb1
9f15796e-035f-4839-b8c3-293d16668d11	177b15c4-ff66-4ac5-b854-3d8ac47d57ba	e303c4c8-4c7f-4d28-a6ce-a505175d2f9c
8a5ff7c0-b8dc-4bcf-b3bb-2f9834a54709	177b15c4-ff66-4ac5-b854-3d8ac47d57ba	40ebc239-e267-48be-9e51-ac533a335463
3b889e62-0de2-4c48-97ec-46b496ee659c	177b15c4-ff66-4ac5-b854-3d8ac47d57ba	044e1923-f4d6-4fd6-9c6b-cd2bcb7810f2
0c4a60b3-32ab-481b-95a8-d2165d5e62e1	177b15c4-ff66-4ac5-b854-3d8ac47d57ba	e0458e81-0b51-4b2a-94bb-c838ba803af5
1ccbe91d-9a89-4365-b8f1-ddde2945b8e1	177b15c4-ff66-4ac5-b854-3d8ac47d57ba	bbe55c78-8816-403c-a74d-8a4394b08e98
219bda4a-db73-47bf-9913-bc87514f08a7	64c41181-8b90-4b82-89eb-6fc84749d2a3	b9ee6475-b5bd-4ebd-8e24-2ffc6e2fc589
2c0b6a9f-2a28-45b8-a1e6-668e0034b598	64c41181-8b90-4b82-89eb-6fc84749d2a3	c4cebf9f-bf6b-493d-9f46-1ecc87d26a5f
a5fdc9b4-ac08-4653-bd10-3850f348d492	64c41181-8b90-4b82-89eb-6fc84749d2a3	23d46554-5d74-4e93-a708-fa52906f2c3c
59f0c219-130a-4ca1-891d-09b49cf82803	64c41181-8b90-4b82-89eb-6fc84749d2a3	0005b580-9cad-4d80-bcbd-16f8bb050deb
29b0717d-a1d7-4b83-b881-addfc0c24b1c	64c41181-8b90-4b82-89eb-6fc84749d2a3	fc86fa76-4331-451b-86fc-a16a9087c8f7
d6695788-ef21-4d55-b1af-2b83248b62e6	64c41181-8b90-4b82-89eb-6fc84749d2a3	2b8bfd11-bb4d-460f-9093-15efd343077e
a102148c-f7a9-47a1-b5cd-7fd48e13d40e	64c41181-8b90-4b82-89eb-6fc84749d2a3	3cba5d8e-8e23-4e53-8872-4b65c8716cb1
cc4e8db3-4d52-4cd8-bb8f-478d43b7b4dd	64c41181-8b90-4b82-89eb-6fc84749d2a3	e303c4c8-4c7f-4d28-a6ce-a505175d2f9c
c9bd3392-3946-427a-aaf9-9bbd171f5d85	64c41181-8b90-4b82-89eb-6fc84749d2a3	40ebc239-e267-48be-9e51-ac533a335463
f832ccb3-9dc9-4f8d-b194-15378e74303b	64c41181-8b90-4b82-89eb-6fc84749d2a3	044e1923-f4d6-4fd6-9c6b-cd2bcb7810f2
cf507d3b-bcea-4a9a-995a-3c7e57e603ed	64c41181-8b90-4b82-89eb-6fc84749d2a3	e0458e81-0b51-4b2a-94bb-c838ba803af5
68205751-cc04-430b-93e8-5703613dfdef	64c41181-8b90-4b82-89eb-6fc84749d2a3	bbe55c78-8816-403c-a74d-8a4394b08e98
b661d5dc-54ab-4d66-aade-41b9b665e8fc	64c41181-8b90-4b82-89eb-6fc84749d2a3	ccee2c60-2ce0-4698-bfbd-ab70ef06b1d9
011ba5ef-9180-4ae9-adab-f4188614395e	64c41181-8b90-4b82-89eb-6fc84749d2a3	7a12cdb1-f7e6-43a5-89f4-5b6ffe041e0f
38610539-aaa8-4f51-9286-85cffbf92705	64c41181-8b90-4b82-89eb-6fc84749d2a3	ac40bf3d-75c2-46f8-9e39-f95ee3448b3d
a408b67d-88f8-48ab-b326-f348ddff77f4	64c41181-8b90-4b82-89eb-6fc84749d2a3	aab98279-1036-455a-b491-24caf4d55ebb
863a573e-1be8-4924-b126-6b9bd5360eeb	5ae82eea-9f46-489e-8486-1dcf09427e9a	7a12cdb1-f7e6-43a5-89f4-5b6ffe041e0f
21e25785-7ee1-4c7c-aef9-d00f8c747c56	5ae82eea-9f46-489e-8486-1dcf09427e9a	ccee2c60-2ce0-4698-bfbd-ab70ef06b1d9
9bab828a-a122-40a5-826a-526214393a0e	4240a2be-16cf-4b58-b588-40536afac2ea	bd65242a-8654-4713-a00b-3a1a57b0e14a
7d264bcf-e596-4165-9ceb-eaf2f52a6434	4240a2be-16cf-4b58-b588-40536afac2ea	dc14fb62-c603-4c56-8cc7-6ced3037f1e3
ace60380-35c9-4b50-85a0-1a628492dbf1	4240a2be-16cf-4b58-b588-40536afac2ea	044e1923-f4d6-4fd6-9c6b-cd2bcb7810f2
c2911c7b-2cf0-4383-8c72-f212891e8779	4240a2be-16cf-4b58-b588-40536afac2ea	23d46554-5d74-4e93-a708-fa52906f2c3c
af54bc8a-69a3-48eb-b9eb-b7ded9b2b250	4240a2be-16cf-4b58-b588-40536afac2ea	c4cebf9f-bf6b-493d-9f46-1ecc87d26a5f
09661f12-f826-400c-a210-65e06e457541	4240a2be-16cf-4b58-b588-40536afac2ea	2b8bfd11-bb4d-460f-9093-15efd343077e
3bac9510-23b9-4728-ac24-6fbffe9eb5b6	177b15c4-ff66-4ac5-b854-3d8ac47d57ba	800d6266-66ac-4c0b-a45e-8e61c2a39a5e
d1da0b41-9634-484b-9b9d-7daa9f6770c9	177b15c4-ff66-4ac5-b854-3d8ac47d57ba	136853bf-8f17-4d78-bcfd-7b407f3f928c
f5d9ebd8-136a-4192-a55a-1449e34dbaf4	177b15c4-ff66-4ac5-b854-3d8ac47d57ba	2e9ec304-aecb-462f-bdc4-8b4d6b8f17bc
4518fd3d-7b57-4dac-b2fb-2b67df6dd865	177b15c4-ff66-4ac5-b854-3d8ac47d57ba	16438e04-d4af-4129-b10e-007fee1b08c5
44c8b1b4-92ec-4347-9fcb-0e18586f1520	64c41181-8b90-4b82-89eb-6fc84749d2a3	800d6266-66ac-4c0b-a45e-8e61c2a39a5e
8124f65e-6218-4ea0-b7b7-3dfcba1065c4	64c41181-8b90-4b82-89eb-6fc84749d2a3	136853bf-8f17-4d78-bcfd-7b407f3f928c
e3fc5a4c-4f6a-455d-9e78-09cc60fdd53f	64c41181-8b90-4b82-89eb-6fc84749d2a3	2e9ec304-aecb-462f-bdc4-8b4d6b8f17bc
e12d73b2-f8e9-4d67-a5f5-c7ba2c92b943	64c41181-8b90-4b82-89eb-6fc84749d2a3	16438e04-d4af-4129-b10e-007fee1b08c5
7ce3be40-9ab4-4809-b456-ca5a6290ffa7	4240a2be-16cf-4b58-b588-40536afac2ea	b9ee6475-b5bd-4ebd-8e24-2ffc6e2fc589
62f40a30-ec8d-4ca6-8101-05e8446ccb26	4240a2be-16cf-4b58-b588-40536afac2ea	7a12cdb1-f7e6-43a5-89f4-5b6ffe041e0f
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: Vynn82
--

COPY public.roles (id, name, is_system, created_at, updated_at) FROM stdin;
177b15c4-ff66-4ac5-b854-3d8ac47d57ba	SUPER_ADMIN	t	2026-08-29 14:54:26.479439	2026-08-29 14:54:26.479439
64c41181-8b90-4b82-89eb-6fc84749d2a3	ADMIN	t	2026-08-29 14:54:26.479439	2026-08-29 14:54:26.479439
4240a2be-16cf-4b58-b588-40536afac2ea	MANAGER	t	2026-08-29 14:54:26.479439	2026-08-29 14:54:26.479439
5ae82eea-9f46-489e-8486-1dcf09427e9a	STAFF	t	2026-08-29 14:54:26.479439	2026-08-29 14:54:26.479439
7810d97d-4d3d-42ad-8efb-1803df256984	WAREHOUSE_MANAGER	f	2026-09-20 10:04:14.415755	2026-09-20 10:04:14.415755
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: Vynn82
--

COPY public.sessions (id, user_id, refresh_token_hash, expires_at, revoked_at, last_used_at, user_agent, ip_address, created_at) FROM stdin;
8cc7ef9e-e3b4-48ff-aae9-19ef55f2f027	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	9b719eefe5e34cc841ed9835bbd8353f7cfeabf896019d2ef881ec3a8bc51a2e	2026-09-05 14:56:07.658+00	\N	\N	\N	\N	2026-08-29 14:56:07.662217+00
49da1350-48e1-420c-bc39-1232c2dd2f41	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	ef677b15592df44da62524d73e7ae44bf4c41078aaf4b5a31a3ba1c99f81ca24	2026-09-05 14:57:25.933+00	\N	\N	\N	\N	2026-08-29 14:57:25.935671+00
0e3f1026-41e0-43a0-ab35-3aa6b6307062	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	813ab0a1683b04754d1f56e7f35717c325e0024fe9b2d9abad4a99d97b24172a	2026-09-06 02:07:20.958+00	\N	\N	\N	\N	2026-08-30 02:07:20.961757+00
2bff1851-ff3c-4c3a-9518-3798a347e4d1	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	7addf193c618ad996128aafdde503e02cef49ed5f9ad5307cc7862d792264fae	2026-09-06 02:18:43.355+00	\N	\N	\N	\N	2026-08-30 02:18:43.359334+00
9661b8f4-0bb2-4b90-91bc-288f0ab9c0da	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	2780db6383ec7f7ba1c1a926da51041b623f66f8e7079782d439ac2189ae7bf8	2026-09-06 04:47:22.498+00	\N	\N	\N	\N	2026-08-30 04:47:22.502272+00
a1d392da-a288-45cb-9875-0291d73fd654	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	147bda346a4133854ea744297dde00f6191bfde78cb73b4d8048026186cf67db	2026-09-06 05:05:58.799+00	2026-08-30 07:26:56.528+00	\N	\N	\N	2026-08-30 05:05:58.803132+00
b1c73e52-0e29-40db-a618-6ba7a0014f9d	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	76b2d30805e2f605155aa98a013d54704a9285e7b1826f351a02816320aa44ce	2026-09-06 07:26:56.545+00	\N	\N	\N	\N	2026-08-30 07:26:56.54944+00
9427c2ba-aa72-4bfa-b94c-1d7cc515009a	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	725008812fe63fec79f160d7ec715a2f0190a31b09443177b0f8ad022d14cbcd	2026-09-07 14:45:19.308+00	\N	\N	\N	\N	2026-08-31 14:45:19.30988+00
eacffbd3-2235-4cf3-927a-631028a210ec	693a56ed-5436-4756-ba32-ff09e691fbfd	360feac9494670fd13c94b95382d743e69014440e6aa3bff17ba5b9077468efd	2026-09-08 15:41:22.863+00	\N	\N	\N	\N	2026-09-01 15:41:22.868013+00
733ef307-275b-439c-a398-89df15695d42	693a56ed-5436-4756-ba32-ff09e691fbfd	5780f1bb39dd5e58000ccd03fdaca4c436ea8cc19d48ea7f3fd7ab261de75d37	2026-09-08 15:42:17.897+00	\N	\N	\N	\N	2026-09-01 15:42:17.898963+00
566449dc-4748-44d1-8f55-98f6629aee56	693a56ed-5436-4756-ba32-ff09e691fbfd	e5eb2870ce9f16a7083791d0670f2b1c89d0356063e72da5f860e8a53817709c	2026-09-11 14:46:45.866+00	\N	\N	\N	\N	2026-09-04 14:46:45.86938+00
b3b658e6-7451-45ee-b305-8edcc9415fdb	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	9fe207bb8242b4c3635abe984a6630812a745063e5a731a65bdbba75e7110f5c	2026-09-11 14:46:58.795+00	\N	\N	\N	\N	2026-09-04 14:46:58.796096+00
1206c472-fec3-4803-b487-0e81491d4912	ba5249c1-bcd2-4647-9206-145a3f73c45c	130c8c3a27b6ffce789346587f481b52f86364fce9fe247d90e075edb424de4d	2026-09-11 15:03:14.187+00	\N	\N	\N	\N	2026-09-04 15:03:14.189606+00
86def555-2afa-42b1-aefc-3b762d5560bf	ba5249c1-bcd2-4647-9206-145a3f73c45c	64f2a45e722834d7e708c420fad4fcb156f18ec02cdf4889ca56a405bf1592e0	2026-09-11 15:04:28.655+00	\N	\N	\N	\N	2026-09-04 15:04:28.656707+00
693f7541-3758-47a2-8546-f943663d78be	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	e32034849e043a388af4c753967f92207e9ce3b5f3193719a8bf333a137a87f8	2026-09-11 15:05:49.098+00	\N	\N	\N	\N	2026-09-04 15:05:49.099744+00
85607a70-803f-44ce-9789-a384903bfa39	1b5e9619-67e1-436a-b494-482acb94bffa	47c3b424a50f951eed4fc7a0a27fffffb194afbbde052b10318a22d46dea20a2	2026-09-11 15:23:12.253+00	\N	\N	\N	\N	2026-09-04 15:23:12.254526+00
13cac419-f3b4-4049-b94e-0c3665b6f55d	1b5e9619-67e1-436a-b494-482acb94bffa	bcb02b99e88930675c9304b565b58dd6e5967ec8f90999757c17aa209471cc42	2026-09-11 15:23:52.75+00	\N	\N	\N	\N	2026-09-04 15:23:52.751362+00
d915cdfb-a3ed-4062-a145-cf820f4e82b7	1b5e9619-67e1-436a-b494-482acb94bffa	bb0c62bce60bffda9e2467a0fc28562f93501e6f86bcd4cc0f0280bb639f0e80	2026-09-11 16:29:55.429+00	\N	\N	\N	\N	2026-09-04 16:29:55.432025+00
9f1f56db-461f-4977-95ed-b796c1fe9a9a	693a56ed-5436-4756-ba32-ff09e691fbfd	740831db19cea37a6417691d1652e7d51c873803b0f7cfdcfb0df0dbc3c9b6cf	2026-09-11 17:05:59.463+00	\N	\N	\N	\N	2026-09-04 17:05:59.466412+00
e83a49f0-0150-4c72-bc53-db31859be164	693a56ed-5436-4756-ba32-ff09e691fbfd	5b61c8cfdaac274f63ec1ce2ab57ce8a334f5d18c19dc0ba380bfed157a2a646	2026-09-11 17:12:00.174+00	\N	\N	\N	\N	2026-09-04 17:12:00.175794+00
28211a0d-a54b-49db-b3da-8ef71606f218	693a56ed-5436-4756-ba32-ff09e691fbfd	fcf326acb54697a804293a14b6aab5081f133743bf71b5f677b6e784859eb48a	2026-09-12 02:59:53.906+00	\N	\N	\N	\N	2026-09-05 02:59:53.910596+00
5472456e-eb07-4ff5-b215-fc736ac634ed	ba5249c1-bcd2-4647-9206-145a3f73c45c	ac48e48fa6da4a1efd0c6ad1e6ee30d1f7ce5541909a7bfa9c3b268d93b9b5ff	2026-09-12 03:06:39.049+00	\N	\N	\N	\N	2026-09-05 03:06:39.054788+00
f4c6932a-16cb-4212-b489-4c90bb851883	ba5249c1-bcd2-4647-9206-145a3f73c45c	b43251d5b0567b857308d4beee079f6c00c501f96e80889124d41dded22ddd68	2026-09-12 06:39:34.648+00	\N	\N	\N	\N	2026-09-05 06:39:34.655064+00
cdb8d152-eb39-4741-a656-f02de5b57a04	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	b991df53e0b0a2d8a53052958d98429d99ffd6859cdd5eec54b9f3c998dd90ec	2026-09-12 07:15:58.637+00	\N	\N	\N	\N	2026-09-05 07:15:58.641873+00
10dcfa89-9c94-47e5-994d-bdc4efc78a29	6a68754f-5511-4927-b46b-86796d1acecb	5220a19d6f96c9d646d4dd1dab542a7c43dfd8432b5007639fe4a65d55edc816	2026-09-12 07:25:51.884+00	\N	\N	\N	\N	2026-09-05 07:25:51.88502+00
a18b2b05-48fd-4a55-a289-ed85c66e2a6d	6a68754f-5511-4927-b46b-86796d1acecb	6f366fe776a2211b2acd90cdc8010a3ab36ad6e55d010ee1e9c272508b5eb695	2026-09-12 07:37:33.938+00	\N	\N	\N	\N	2026-09-05 07:37:33.941222+00
61138d5b-f230-4bbe-b38c-99d3aaab389e	6a68754f-5511-4927-b46b-86796d1acecb	42218e79c257ec891099ea2fdaf3a143557ae6f0e330de93c05c396c62fee390	2026-09-12 07:46:19.026+00	\N	\N	\N	\N	2026-09-05 07:46:19.026772+00
f8e65b3f-a6fb-40f7-a4c6-3b88837919c3	6a68754f-5511-4927-b46b-86796d1acecb	134c9ee5bdd7f0fb8a474c658127746bd6c6b07add2b901cca6928da7cbb9e23	2026-09-12 07:49:32.96+00	\N	\N	\N	\N	2026-09-05 07:49:32.961067+00
6ffae65e-78cb-4b21-b00c-9cfec02ac737	6a68754f-5511-4927-b46b-86796d1acecb	699da41bd220036522ae24ff55de1ed246cd10146bddf959fcb18bb21f5ecb84	2026-09-12 07:59:13.812+00	\N	\N	\N	\N	2026-09-05 07:59:13.813612+00
b6767959-746d-4dae-94d9-515b2b5adf5a	6a68754f-5511-4927-b46b-86796d1acecb	b3e41cdaef6c6ea42c6e07df6737e5293ed2d771e91d7d4153c3e2c659516a2a	2026-09-12 08:09:06.553+00	\N	\N	\N	\N	2026-09-05 08:09:06.555244+00
df1c1e9b-315e-47c9-b62d-d8df374b3853	6a68754f-5511-4927-b46b-86796d1acecb	21edae4b906ce9da45193a4ba380ec2f3731d675fe2a383602d0888b40902730	2026-09-12 08:34:19.426+00	\N	\N	\N	\N	2026-09-05 08:34:19.426829+00
13b2e505-7b81-48b2-9b0f-e642cd3769cb	6a68754f-5511-4927-b46b-86796d1acecb	f5badc74824182b688058add076087027bfe408fefe373fc06ae60dc03ea565d	2026-09-12 08:44:01.438+00	\N	\N	\N	\N	2026-09-05 08:44:01.439747+00
28a5470b-50df-49da-8ed5-b8b123705a2b	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	32676e8a7b178a099f52304de0c60dd816d449ac775c1599f8e94cc8f0d45efb	2026-09-12 08:46:58.74+00	\N	\N	\N	\N	2026-09-05 08:46:58.74515+00
e45bc2f3-c609-4249-aa35-12fe262703ed	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	9875ab985852bf6a66b9fdec7f7f581ff28e279900bf629c61d5d9c19087ed21	2026-09-12 08:57:32.206+00	\N	\N	\N	\N	2026-09-05 08:57:32.208443+00
a444234c-eb46-4805-bfbc-33fc3a601aa1	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	7240493ba80faf1312ede41797a3e726239e17600387c4d80d1871c99b09aab8	2026-09-12 09:21:46.409+00	\N	\N	\N	\N	2026-09-05 09:21:46.409954+00
0c2c4a36-414e-47d1-9985-ee47c6257dee	6a68754f-5511-4927-b46b-86796d1acecb	c2eb39845195c8b56f1582b8a56aea045a91972ee13eb5497af91541bcd3f342	2026-09-12 12:00:21.863+00	\N	\N	\N	\N	2026-09-05 12:00:21.865572+00
52b1c982-309c-402d-808b-0b3be676d787	ba5249c1-bcd2-4647-9206-145a3f73c45c	15f766bb0a93b1c0520b73dc3520c17df6281d28af9c11c665df5ad0f0c0982c	2026-09-12 12:20:17.193+00	\N	\N	\N	\N	2026-09-05 12:20:17.197142+00
b0814491-dd14-4df8-a9a6-aa22a8a43109	6a68754f-5511-4927-b46b-86796d1acecb	f749287f0bf746b094e3089251ccd7a990ee46837b220d82f8885bd80f451d90	2026-09-12 12:23:56.305+00	\N	\N	\N	\N	2026-09-05 12:23:56.305418+00
19bfdbc0-273e-45f5-995b-9266b3ac8f53	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	fbda7770d543e7100050e1d6f6cd47c3b70efa68798cd869293dcbe6d4a9e996	2026-09-12 12:34:56.842+00	\N	\N	\N	\N	2026-09-05 12:34:56.84145+00
fbc5387d-7a50-48a3-93ec-8ade40116262	6a68754f-5511-4927-b46b-86796d1acecb	efe8361fd68a108e7a6d6d2e9fd1e983e10fcf1a07c4247bbc453a76951591dc	2026-09-12 12:45:43.39+00	\N	\N	\N	\N	2026-09-05 12:45:43.391621+00
4fded339-f147-41b3-9050-b3e52bf61644	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	ed42917220bf228e0838eee155dbc5013539471fdcf2fc82475dd8f1a9d2c449	2026-09-12 12:53:12.171+00	\N	\N	\N	\N	2026-09-05 12:53:12.173423+00
3fabbf0c-d4ef-4189-8050-838b2fa2a924	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	26b1761aed3ca0e83e316963c2c305644a7ff9ede85ea90851f7e25af9a25037	2026-09-12 13:12:12.805+00	\N	\N	\N	\N	2026-09-05 13:12:12.807407+00
786b0c89-9e70-4401-9634-b47375b44f19	6a68754f-5511-4927-b46b-86796d1acecb	49d688f35afbdfbe7c173a20ae85ae1ab8284c329e2012b2c19e63a9d781dcef	2026-09-12 13:14:28.469+00	\N	\N	\N	\N	2026-09-05 13:14:28.470023+00
bfdcdbf9-0803-4d43-9685-b02a242dd9eb	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	42251a5d1d72ada0cf9b8b8da52f264fb8d3be6fe6524533e6a7fadcc1c7ff55	2026-09-12 13:27:45.529+00	\N	\N	\N	\N	2026-09-05 13:27:45.531835+00
fc07e3d2-3bb4-46a1-b58b-81b5913114cc	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	2c76a682ce1df4ce230cc7052107252b85f2f3e2da718ca47ae4a6376ca07011	2026-09-12 14:32:01.651+00	\N	\N	\N	\N	2026-09-05 14:32:01.652246+00
742f5b33-877a-440e-981a-f4886273e8a3	693a56ed-5436-4756-ba32-ff09e691fbfd	67c73986c5fcf94d05ee608a3927505204b3a1d378565ebfc0a1e72ac53364b7	2026-09-12 14:52:23.423+00	\N	\N	\N	\N	2026-09-05 14:52:23.429178+00
7338bf2d-2de7-48bf-a967-8f412b1655a2	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	f450969624e24df8db4beb3043406168a8d2f83d95a431f4c6b3a8b56b8ac46c	2026-09-12 14:53:27.257+00	\N	\N	\N	\N	2026-09-05 14:53:27.258412+00
1e1a0638-1183-4230-90e5-046aa47128f5	693a56ed-5436-4756-ba32-ff09e691fbfd	f45350823782968bc5d9e8d04366f24b35986e0506513b7755b13bbf013c7179	2026-09-14 14:29:00.953+00	\N	\N	\N	\N	2026-09-07 14:29:00.957407+00
29feaec8-dfa4-4a59-9249-e7bcd0250d1c	ba5249c1-bcd2-4647-9206-145a3f73c45c	53800767190a9a40045ed13ab5a44d391274700b295739f1cf34f0a013f2502d	2026-09-14 14:29:28.15+00	\N	\N	\N	\N	2026-09-07 14:29:28.151543+00
e1fbc90e-8bef-4250-b55c-b9a32e751d55	ba5249c1-bcd2-4647-9206-145a3f73c45c	cf5feece67ec078a9b9645f5b121a62da215b324e559f96407be887dc82c07c7	2026-09-14 14:31:19.129+00	\N	\N	\N	\N	2026-09-07 14:31:19.130639+00
5b465bf7-4d55-4458-9420-b77699e700eb	ba5249c1-bcd2-4647-9206-145a3f73c45c	ce8cc477e9c4302bb2270facc49f6fc4fadb8ff31011306c27668ad915f6acd1	2026-09-14 14:43:43.157+00	\N	\N	\N	\N	2026-09-07 14:43:43.158216+00
89805fcb-c562-4a27-8dea-abbad8eb3844	ba5249c1-bcd2-4647-9206-145a3f73c45c	174fa22aa657cefab36fe26ec4c3463b36a018aa4c1dbac87a1e20b565e91700	2026-09-14 14:43:44.411+00	\N	\N	\N	\N	2026-09-07 14:43:44.412317+00
b7fbad34-c1de-4d31-9a61-8fac4dad9ba9	693a56ed-5436-4756-ba32-ff09e691fbfd	193d05f75d3203a0e503a26ecd136d19ec310db8c891b807da649ea39bfc9373	2026-09-14 14:45:28.706+00	\N	\N	\N	\N	2026-09-07 14:45:28.708031+00
72ad2744-89ef-4ff0-9409-8f5940717056	ba5249c1-bcd2-4647-9206-145a3f73c45c	2e785444410271150751114f864cdfbc00403eb3d53e91d2e4d7564ca60b10cf	2026-09-14 15:01:53.623+00	\N	\N	\N	\N	2026-09-07 15:01:53.627127+00
c61f5c77-d77b-40ef-9b41-e702c5bfa15f	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	7edf5966a7c398028cf73cda92159a7d598486cff2dd4b0b193e038f4333e824	2026-09-14 15:02:27.169+00	\N	\N	\N	\N	2026-09-07 15:02:27.170842+00
1eb11e73-bcd9-4455-8027-385abf6925b3	693a56ed-5436-4756-ba32-ff09e691fbfd	501e565108d3c6f0db4f26a4e8c348fc0a4a3c45dccdba213e79dd3e717e4d58	2026-09-14 15:02:56.964+00	\N	\N	\N	\N	2026-09-07 15:02:56.967042+00
63dec2e8-99a2-4fb4-9f25-9b72e3009477	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	ccaf6e8689070a799b29626214991aa45353ffedb7053022de15cbd27f76a98a	2026-09-14 15:07:56.358+00	\N	\N	\N	\N	2026-09-07 15:07:56.359295+00
23be8ab4-50d7-477f-8228-a5c6f7a894cd	ba5249c1-bcd2-4647-9206-145a3f73c45c	f072b8e022cc77a81cb2994c6a1df65a4d563e170413dedd9efcb572b963fc84	2026-09-14 15:35:24.835+00	\N	\N	\N	\N	2026-09-07 15:35:24.840461+00
466092ae-3c5d-451d-b3d3-cba795077d01	1b5e9619-67e1-436a-b494-482acb94bffa	3dbdb69bebaca7f24658b97b47062638d0bbdcc53185d1fc52aca3d802c52d5c	2026-09-14 15:36:22.816+00	\N	\N	\N	\N	2026-09-07 15:36:22.817075+00
d634742b-7d0b-4dce-bd38-b88c8c09a008	693a56ed-5436-4756-ba32-ff09e691fbfd	686bcaf17805e10997362c8e36fc12d04ca8cf9d451cea825556cd544b148858	2026-09-14 15:37:25.662+00	\N	\N	\N	\N	2026-09-07 15:37:25.664504+00
e8800a51-e7fa-421d-bdde-37c24755075c	ba5249c1-bcd2-4647-9206-145a3f73c45c	b11b026f20e6592de9a5ac4f9d140b44b1da33a7deb29f131c601ff956232d9d	2026-09-14 15:38:18.022+00	\N	\N	\N	\N	2026-09-07 15:38:18.023531+00
7d2e606f-7128-4041-88ba-4a0ee52eda61	693a56ed-5436-4756-ba32-ff09e691fbfd	67164c92fc9ae3104087d8c3dcfa792cb0623ffefdc52622f7b1e319fc9b22d2	2026-09-14 15:58:57.303+00	\N	\N	\N	\N	2026-09-07 15:58:57.3053+00
7e55b54b-fd1a-402a-80b4-416b9e2c7bce	1b5e9619-67e1-436a-b494-482acb94bffa	d50c41e88c615147d566d49a363cb9bda7c009149c69a195fac047dc65db9c4e	2026-09-14 16:02:07.912+00	\N	\N	\N	\N	2026-09-07 16:02:07.913339+00
38407d65-3042-4367-a34c-251910724d4d	693a56ed-5436-4756-ba32-ff09e691fbfd	4fa47c932c22e69907896761bc637e2a82e82abc730690bbc33a0c39c21fed02	2026-09-14 16:03:17.65+00	\N	\N	\N	\N	2026-09-07 16:03:17.651658+00
26fefc5f-79b3-4a82-9e43-ff398644466c	693a56ed-5436-4756-ba32-ff09e691fbfd	5647cdf5c9657b538ae5aa662f96dc89cca2f86106b091bfaa90c9119c190f1f	2026-09-14 16:04:07.348+00	\N	\N	\N	\N	2026-09-07 16:04:07.349721+00
53a0dbbf-80fe-4cb9-9776-a7a5ac83be88	ba5249c1-bcd2-4647-9206-145a3f73c45c	ebc4ba25d7101531f63638bdf8b4e7a31afad2788860f794619ac1eaf292c30d	2026-09-14 16:04:41.169+00	\N	\N	\N	\N	2026-09-07 16:04:41.170486+00
5b7e8c16-9a50-4c4a-b7fc-24bbe84c8653	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	6a23699d9b851bac3864344e27b05c28267a991fd85ca1713ae029fd2f29ab9d	2026-09-14 16:06:11.748+00	\N	\N	\N	\N	2026-09-07 16:06:11.749384+00
44fea063-b602-47b7-bff6-7bcefa295f21	1b5e9619-67e1-436a-b494-482acb94bffa	96118fab63e45c9e21d6f2cd9db25ffe42124358ec34282f67e031707b531744	2026-09-14 16:07:08.905+00	\N	\N	\N	\N	2026-09-07 16:07:08.90669+00
06cc4ddb-6e9f-4a8e-a8f4-5217595f32bf	1b5e9619-67e1-436a-b494-482acb94bffa	6e993ba77d0265b36c1c059ed5054d0a999b403e884364ed3878357124c1fdbd	2026-09-16 14:36:47.576+00	\N	\N	\N	\N	2026-09-09 14:36:47.57769+00
8dcafc65-fb05-4150-a932-6a47e4a0e477	693a56ed-5436-4756-ba32-ff09e691fbfd	0bc8b4f993542b1b1ec0632451898552229a01a423b977b54e5379238ceb0eb5	2026-09-16 14:37:24.11+00	\N	\N	\N	\N	2026-09-09 14:37:24.110845+00
877ec2ce-ec3e-40a0-80ef-1299f71d8c5f	ba5249c1-bcd2-4647-9206-145a3f73c45c	bcba19a338256afa36b97006735fc0352b1bc5d75cabd2278625403082fb95e2	2026-09-16 14:38:10.053+00	\N	\N	\N	\N	2026-09-09 14:38:10.054295+00
bf13f137-2e14-4d23-8bdd-c68ac51b2fdb	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	a7d18c0aa57bf2ac57736cc1391c0d369c6ce6f6f5d5040fe55fce792faef12c	2026-09-16 14:38:55.319+00	\N	\N	\N	\N	2026-09-09 14:38:55.321516+00
b8eafa99-6bbe-4975-9f93-41d078088d1b	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	c900e7b47f979f8ffce8293f25f040b1f89ff37ab93f7fc91bb9fa5472ddaef2	2026-09-19 06:49:41.944+00	\N	\N	\N	\N	2026-09-12 06:49:41.949244+00
653cb06e-56a7-440e-a4e7-21939786b403	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	a4f6e1efde1c6536787bc154b02bd7815389f72bb8e86993eadd040bd98e10c7	2026-09-19 08:50:49.967+00	\N	\N	\N	\N	2026-09-12 08:50:49.974121+00
bdef3552-7b70-459a-adf7-4d76fb7d92ae	ba5249c1-bcd2-4647-9206-145a3f73c45c	d8e99baa8e76605debe28ca8df0e19fe496f458b6091d83e85918182482548a1	2026-09-19 08:53:15.522+00	\N	\N	\N	\N	2026-09-12 08:53:15.526075+00
af602de6-6f02-43a7-ab6a-6d0841e1039f	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	b2acaf86435050ab124116e916e7e0c72a7cfdab7e74e2fded8a077288e105ef	2026-09-27 07:53:11.38+00	\N	\N	\N	\N	2026-09-20 07:53:11.382259+00
8135e7e1-eb47-4c86-9b11-40e212ea730e	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	d845e6d8e1934e0d88c2507d9234444b29076466842e49a626dbd2d8ad8d1249	2026-09-27 07:54:43.183+00	2026-09-20 07:54:43.205+00	\N	\N	\N	2026-09-20 07:54:43.183653+00
089884a2-f898-4905-94fc-564261a9e000	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	fb1aaec0c7c095390ae7ed8a59e9b8ce99aa720a198de0bf7474f21b87b665c8	2026-09-27 07:54:43.207+00	\N	\N	\N	\N	2026-09-20 07:54:43.208048+00
6bb8c855-5bb7-48dc-911a-d817a4300b5b	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	ca7ee7eb1a5ebcb4854cfa2eb465b5fd11475adc35400b03d44f37f7afeba428	2026-09-27 07:54:54.61+00	\N	\N	\N	\N	2026-09-20 07:54:54.611455+00
2404835d-2609-47e0-9046-906f0ff3255c	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	e65ecbbbaa2c8ae652db748eefd93104825bd4c5ed8e826127baccc10620dc30	2026-09-27 07:55:08.833+00	2026-09-20 07:55:08.853+00	\N	\N	\N	2026-09-20 07:55:08.834098+00
453c1669-1b9d-4772-af25-d95d88012a7e	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	935aa2255a604443f9a05cc1ad64a1bc2f76d466ce02929ba6cb2ca09d715b93	2026-09-27 07:55:08.855+00	\N	\N	\N	\N	2026-09-20 07:55:08.855817+00
60b94a8a-79be-46a4-9cd2-52f311ec4373	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	46dc73c028c3c6481d540ef009b8a94bb061575048be1601bf265a169c03d321	2026-09-27 07:55:20.579+00	2026-09-20 07:55:20.598+00	\N	\N	\N	2026-09-20 07:55:20.580167+00
b0a00ff2-86b5-4f24-a4b4-e870d35bb40f	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	20ccf9d9466a15cd44cbbe9278f5c8d1cc6675db621b4ca5362676b8d3edef4d	2026-09-27 07:55:20.6+00	\N	\N	\N	\N	2026-09-20 07:55:20.601118+00
106964d2-757f-469f-8c59-68cad8b0f7e4	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	817730689d76bd62a4e4a7834983d9e07a4ca602e291596fc493ab972eac70fc	2026-09-27 07:55:49.173+00	2026-09-20 07:55:49.191+00	\N	\N	\N	2026-09-20 07:55:49.174819+00
060b21e7-833a-4d7d-b826-25d2e4b7595f	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	bd42bb3c8817da94944c40fb74052a48ec0c6cc5667ec4551875f33a116bb2a4	2026-09-27 07:55:49.193+00	\N	\N	\N	\N	2026-09-20 07:55:49.194253+00
78da5102-b949-49b4-8c8e-7b2002d675a2	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	1b65f68e784ddbd6a4019f28fc1adb2b835404922ae006d4177a14a6733093a8	2026-09-27 08:07:10.902+00	\N	\N	\N	\N	2026-09-20 08:07:10.903035+00
57ca33d8-a3b1-414c-9454-b21d9d9fa5bb	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	11f618236c3b18fab3f0b809026876ad3093d8b746d979d8449334dce6c8fc4c	2026-09-27 08:27:17.383+00	\N	\N	\N	\N	2026-09-20 08:27:17.385723+00
91e733e8-ad92-46b5-bfec-1f842add517a	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	fa1df2c4fcd742f31e72df60cf1ad25147879c8eda059a8957655e3a2956e801	2026-09-27 08:29:37.733+00	\N	\N	\N	\N	2026-09-20 08:29:37.735337+00
c6969790-5b95-493f-b382-225af02d8c76	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	f149ccdbfa551b67d39625ed946d0d13dd6aef893e4d36342cfdb3138d89e79e	2026-09-27 08:31:14.476+00	\N	\N	\N	\N	2026-09-20 08:31:14.478444+00
09c06b59-4dd5-4e23-a5ca-d38039e8a1a9	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	eb00cdf19a237783d984949471aa2f43e503403184628397f4c5b0817315a074	2026-09-27 08:31:22.503+00	\N	\N	\N	\N	2026-09-20 08:31:22.504278+00
5d16117e-15e9-4ef4-af3a-9cc17f8ff446	693a56ed-5436-4756-ba32-ff09e691fbfd	15bb91d7068855b9a5be68eb4f79b3c440ba09360a78ff65ed9d0161fbd9ed53	2026-09-27 08:31:22.712+00	\N	\N	\N	\N	2026-09-20 08:31:22.713954+00
e8146acb-29f1-4599-bbda-c6fa4e212fd0	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	389703b6550bec8714b9f3e056414a4420a768ea046c9c44e88d5465fb250bd6	2026-09-27 08:32:22.566+00	\N	\N	\N	\N	2026-09-20 08:32:22.56983+00
205286c5-f8a6-47b6-96ff-c81cd8fc89df	693a56ed-5436-4756-ba32-ff09e691fbfd	078bd364983695d3ebd8a47b19d8641830395c38e1c9046df28e9f58c099e816	2026-09-27 08:32:22.786+00	\N	\N	\N	\N	2026-09-20 08:32:22.787656+00
dc9dcaa1-6832-4e16-96cf-49aeb39646c8	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	84059e629e1fed73d09256f943fb29e4a73a132ee62fd840952d1a91ebd2b00f	2026-09-27 08:32:34.642+00	\N	\N	\N	\N	2026-09-20 08:32:34.644247+00
d8943ca1-465f-43cf-82e8-d8cacfecc96b	693a56ed-5436-4756-ba32-ff09e691fbfd	e2f60ec2ee71a822cecbb101b1a395f02d404699d2f2b9525de4faa470b90437	2026-09-27 08:32:34.847+00	\N	\N	\N	\N	2026-09-20 08:32:34.848668+00
2e9ce83a-28cb-4369-9b23-f9b61bb632f3	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	f697fde6bca5b605e77a53d3ac875e8ea84f928fd09c71301f9bc17b6d8f91b8	2026-09-27 08:32:49.186+00	\N	\N	\N	\N	2026-09-20 08:32:49.187772+00
a0106a83-107a-4b25-ab19-71d97486704d	693a56ed-5436-4756-ba32-ff09e691fbfd	ccd6704faa04caee16919973ecc7b6aa825bb911fa345b90a919848d0c1d2d48	2026-09-27 08:32:49.392+00	\N	\N	\N	\N	2026-09-20 08:32:49.393896+00
51300eb8-d58c-4833-beb3-2b75a04527ca	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	7c8b9497de8d8548ba0ba99d6117400dab1eb279b4beceaa180c337cde64953b	2026-09-27 08:32:59.786+00	\N	\N	\N	\N	2026-09-20 08:32:59.788335+00
ff6c955f-cacf-4b2d-8517-7ae2276c41a3	693a56ed-5436-4756-ba32-ff09e691fbfd	3962d6cd9e0350a3c9f7be281f17202d84cf598a3fc2ddea07aa3fac749efd88	2026-09-27 08:32:59.987+00	\N	\N	\N	\N	2026-09-20 08:32:59.988637+00
ebb7ceaa-0fe1-4a67-8f88-aa9643e78292	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	736d4c79bad8b3ab4be7635fd66e9223b1b6e56275d5d1921eebe0147f1acaf9	2026-09-27 08:33:05.69+00	\N	\N	\N	\N	2026-09-20 08:33:05.691257+00
fab6d6cc-5ed6-4c35-bb9c-24bfc5223385	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	d8698dabd3b542e4e3d426cb9a315263e48cd0746374859564e717a411ef460a	2026-09-27 08:33:30.804+00	\N	\N	\N	\N	2026-09-20 08:33:30.805857+00
e9ae57d0-5f85-4be5-bab4-33194928ca6d	693a56ed-5436-4756-ba32-ff09e691fbfd	4bfbadf285b38bfe7b9159675b103afc18e574c773d5b3248def0bbc93e14382	2026-09-27 08:33:31.01+00	\N	\N	\N	\N	2026-09-20 08:33:31.011991+00
23fe2852-23fc-4734-bce2-07ed16ae9ab0	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	6dc5909d73062a4dd9def5e414fad53b4db8d25b8d5bdd420df965506a353628	2026-09-27 08:34:12.218+00	\N	\N	\N	\N	2026-09-20 08:34:12.218337+00
2a9592bd-32c9-4976-b5b3-3472988ae136	693a56ed-5436-4756-ba32-ff09e691fbfd	f810b3657e844825aed095866fc64f4c6317fb1b63966f3f1d50f710f854dca3	2026-09-27 08:34:12.424+00	\N	\N	\N	\N	2026-09-20 08:34:12.424766+00
4421a484-63cf-488e-aacc-7bf04c89f5ab	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	2cc8b8ad08e3750f6e73d8fcacb4af039b0f4ddf28ffd66c191b00a6d9336ecf	2026-09-27 08:34:31.772+00	\N	\N	\N	\N	2026-09-20 08:34:31.773044+00
ab8dfbd3-3b4d-470b-93b7-edcae10ab861	693a56ed-5436-4756-ba32-ff09e691fbfd	73e69993a7d9b69bac7753793f475f7af666e4764b0e87279232682b9257f2e9	2026-09-27 08:34:31.976+00	\N	\N	\N	\N	2026-09-20 08:34:31.977294+00
24372c99-5f42-45fd-91e4-465a630cfa11	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	a8d3e84aef7f91475c11ff2bfe5f13bd02ed1b61e5fbff50c512fe484521be72	2026-09-27 08:34:38.829+00	\N	\N	\N	\N	2026-09-20 08:34:38.829475+00
6b3e001f-b9f4-4764-9bf8-66b7f068b636	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	0fa27bfe45275739062a214de120b5b90469503bc49e297668403fd405b084e8	2026-09-27 08:37:38.764+00	\N	\N	\N	\N	2026-09-20 08:37:38.766199+00
0fb7fe5d-7a54-4930-88d4-9535040005d4	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	c7cb434b79533d22b5e864012345c23fcf45532ae1f1c9bee7b337f2fec83413	2026-09-27 08:37:55.217+00	\N	\N	\N	\N	2026-09-20 08:37:55.217961+00
fe61111a-b0ea-4432-8b19-644a61ecc76b	693a56ed-5436-4756-ba32-ff09e691fbfd	9ce95ee618d9722ba02b62bc37a7dcce85e246a8d89ad66c87d7ce52f979b572	2026-09-27 08:37:55.418+00	\N	\N	\N	\N	2026-09-20 08:37:55.419695+00
003aa858-2485-4bb2-b52f-87d723837d82	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	59facf47ed729947b607ac91a3982745363d639d9119e0b2e132f381264ee85e	2026-09-27 08:59:06.576+00	\N	\N	\N	\N	2026-09-20 08:59:06.578344+00
13b60c9e-7f6a-445a-b3bf-f4f943a379e6	693a56ed-5436-4756-ba32-ff09e691fbfd	a680abf340a0caac19418d8b644478d65b215af17c1309482c8d2612631596e5	2026-09-27 08:59:06.787+00	\N	\N	\N	\N	2026-09-20 08:59:06.787905+00
c0c2f6d9-6c07-4fc6-a237-0dad584e1e1c	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	8ef082fb42b9fca6d1c92e57b6c4d90a2b683cc314aa53f06c532742bd7bdd3a	2026-09-27 09:06:43.103+00	\N	\N	\N	\N	2026-09-20 09:06:43.105222+00
80a81293-630f-45e8-9b35-6ca7874515a7	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	a5c6bb0085a3b91f585371cc221979dfefead2c602cc6f486a90c9d711c6538d	2026-09-27 09:33:07.003+00	\N	\N	\N	\N	2026-09-20 09:33:07.006594+00
e0e5dce6-46d0-45a7-b51c-d4629b3b427f	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	75136839844bb42ec1add49f1b00cc43e5ff271c89e6bf41ba6af854a998cc94	2026-09-27 09:33:46.227+00	\N	\N	\N	\N	2026-09-20 09:33:46.22895+00
84b97359-41a5-4b9e-96ba-aed328f54ebd	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	e3dd6b0bc5485177540c425edbe1d86c68fecc08cef9b7c85e87c5f42d44f69f	2026-09-27 09:56:11.036+00	2026-09-20 09:56:48.99+00	\N	\N	\N	2026-09-20 09:56:11.040534+00
fb29d064-cb10-459e-a0b8-4e8a461bac65	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	6ef70b96ca69025fc69ddff731ba61871e1c613b2b3f41b8800b0666f53a8121	2026-09-27 09:56:48.995+00	\N	\N	\N	\N	2026-09-20 09:56:48.997098+00
b7baa151-ad9e-4f67-91cc-b32f2338dc17	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	2d13a9260c05a76f59a34043e37900c7828d95288139b53152f22089bc74b1c6	2026-09-27 10:00:54.445+00	\N	\N	\N	\N	2026-09-20 10:00:54.448249+00
20765e83-1a34-4d89-a027-51f158b600e2	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	28dd5bed39b7bb02a207edbb0b5b9e8aac319222c2dc92f8938d7b353de91000	2026-09-27 10:03:58.361+00	2026-09-20 10:03:58.502+00	\N	\N	\N	2026-09-20 10:03:58.362588+00
6fc72518-67d6-47e0-8145-7641e645266e	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	4e3284168927f08fa335904b06d53f449ca7c46bc155faf42b1702debf50f49e	2026-09-27 10:03:58.507+00	\N	\N	\N	\N	2026-09-20 10:03:58.508225+00
88c17db6-ce3c-47f5-a219-6ed47df6eff7	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	1988ba3ff14c0f6a0e11d38b479a4d8577cc90b6af36603982292b1c65e860d6	2026-09-27 10:04:14.18+00	\N	\N	\N	\N	2026-09-20 10:04:14.182812+00
73c3d6fc-0a8a-4693-a8d0-5547b631bb86	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	b9a0abfc82f6c0bbf164b64ba885d702596e866e0e3f00b4f1f7035415855d9e	2026-09-27 10:07:41.056+00	\N	\N	\N	\N	2026-09-20 10:07:41.058352+00
4e866f89-d705-4fff-a6d2-d068d98adaef	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	2a9eca1c8864ef10ab1020069b150c0171e90cc7aa1fe89f688252c31ce8ff25	2026-09-27 10:15:44.202+00	2026-09-20 10:15:44.23+00	\N	\N	\N	2026-09-20 10:15:44.203153+00
b6053d99-cf5e-4c77-b57f-db620dc50d93	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	89c9a60e20133a5cd2dc734eb2a50728da0bd63e260541e699b82fadaa8463b8	2026-09-27 10:15:44.232+00	\N	\N	\N	\N	2026-09-20 10:15:44.233685+00
03ba9e30-2f97-4235-8536-c0f4533eaa36	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	cc0567dc28e7e6ec4ba5b5d68f194bc60089e0570a04fe244fb95631912c8c4b	2026-09-27 10:38:31.856+00	\N	\N	\N	\N	2026-09-20 10:38:31.859117+00
eb56ded2-eb1e-44a2-bfda-cc4ee96470a6	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	ddd85d5404cb95639c11d6be97126c79cd60eec195d7180a21220a38d7c08fd9	2026-09-27 11:04:47.16+00	\N	\N	\N	\N	2026-09-20 11:04:47.163727+00
3d90842f-7094-4e73-8058-09d43e9f0bc2	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	f3ec07ff7b02a2462f2878b114f4893447f6172ae5ae0d5f0ede6aaaf9f00d90	2026-09-27 11:04:56.164+00	\N	\N	\N	\N	2026-09-20 11:04:56.164273+00
4bd617f7-1495-469b-94b0-565351a2d981	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	4ecf60fa1322d359163c300332186acef95d440abb95db298f507dd38cb28e4e	2026-09-27 11:05:07.501+00	\N	\N	\N	\N	2026-09-20 11:05:07.502028+00
9246d072-af2f-45e9-9941-81bae902db6e	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	a53e17f684115e4b8f5cec6be019f60f8f50d920c35443a01cef833e9c4414d4	2026-09-27 11:05:35.603+00	\N	\N	\N	\N	2026-09-20 11:05:35.60526+00
1da5fa9f-c64c-46c2-a462-7afc3915af83	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	62cdb0dbafe13714daa1adf6996ccfda686fded05cbaa96eecf264363a505d25	2026-09-27 11:06:54.348+00	\N	\N	\N	\N	2026-09-20 11:06:54.350394+00
7ed51235-3e0c-4b99-b64d-df37ea6fce9d	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	ef173fd4cea702701080ec9d715b5f3251123007185c68d3b11b6de0851fd76a	2026-09-27 11:10:54.995+00	\N	\N	\N	\N	2026-09-20 11:10:54.997463+00
4af4054f-6b4a-46e0-8ff6-9eeceb32c839	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	7d67eed3cbeb43594786c8632212bfe312d9a2005a218c299fbc2957f2e362cf	2026-09-27 11:15:11.934+00	\N	\N	\N	\N	2026-09-20 11:15:11.935215+00
13fb6e91-fb50-48e3-9533-3280dfda6b50	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	a7c8053544fa74e56111ff24f1ce2d26631d1adffbb4607cf5e97fe04fff9c1f	2026-09-27 11:21:46.809+00	\N	\N	\N	\N	2026-09-20 11:21:46.810192+00
\.


--
-- Data for Name: stock_adjustments; Type: TABLE DATA; Schema: public; Owner: Vynn82
--

COPY public.stock_adjustments (id, request_id, product_id, variant_id, warehouse_id, adjustment_type, quantity, reason, created_at, adjusted_by_id) FROM stdin;
f8b4034e-1722-4b1f-97b0-9ffc660a50ef	65c6da8b-27c6-41c6-82a7-37ba0309f57c	6fb7376b-3b70-40e8-975c-524510dc95c5	\N	63dc2ed2-cc55-45da-bf81-48e2c184fc16	INCREASE	5.000	Manual stock addition test	2026-09-20 08:34:12.459914	\N
2d0eeb7e-0e15-474b-a540-f98bc6f35fd6	102ae3c3-ed37-4afe-85b2-32b6d1dedcdf	6fb7376b-3b70-40e8-975c-524510dc95c5	\N	63dc2ed2-cc55-45da-bf81-48e2c184fc16	DECREASE	3.000	Expired inventory test	2026-09-20 08:37:55.467319	\N
70689cd4-b41b-4294-890b-9965bd3957dd	8dfa53fc-612c-4a03-b7da-f8aff69ad4cc	6fb7376b-3b70-40e8-975c-524510dc95c5	\N	63dc2ed2-cc55-45da-bf81-48e2c184fc16	DECREASE	2.000	Lost inventory test	2026-09-20 08:37:55.520085	\N
0ca65e73-5fee-46a7-8ee2-c6f8c761e475	\N	6fb7376b-3b70-40e8-975c-524510dc95c5	\N	63dc2ed2-cc55-45da-bf81-48e2c184fc16	INCREASE	5.000	Direct audit recount surplus (+5)	2026-09-20 08:59:06.828107	693a56ed-5436-4756-ba32-ff09e691fbfd
f6415a8e-d357-4159-8295-286c10f5bd12	\N	6fb7376b-3b70-40e8-975c-524510dc95c5	\N	63dc2ed2-cc55-45da-bf81-48e2c184fc16	DECREASE	2.000	Direct damaged stock deduction (-2)	2026-09-20 08:59:06.845164	693a56ed-5436-4756-ba32-ff09e691fbfd
d1c8235f-8532-4e5b-9851-ee335db5adbc	\N	6fb7376b-3b70-40e8-975c-524510dc95c5	\N	63dc2ed2-cc55-45da-bf81-48e2c184fc16	DECREASE	3.000	Excel direct inspection deduction	2026-09-20 08:59:06.875929	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c
d329bd3b-c7ac-4488-b8af-7fa1e08cc3a4	\N	6fb7376b-3b70-40e8-975c-524510dc95c5	\N	63dc2ed2-cc55-45da-bf81-48e2c184fc16	DECREASE	2.000	Excel direct inferred DECREASE (-2)	2026-09-20 08:59:06.893256	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c
26db8ac3-cc8e-410e-8d79-21b23644a37a	\N	6fb7376b-3b70-40e8-975c-524510dc95c5	\N	63dc2ed2-cc55-45da-bf81-48e2c184fc16	INCREASE	5.000	Excel direct inferred INCREASE (+5)	2026-09-20 08:59:06.893256	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c
\.


--
-- Data for Name: stocks; Type: TABLE DATA; Schema: public; Owner: Vynn82
--

COPY public.stocks (id, product_id, variant_id, warehouse_id, quantity, created_at, updated_at) FROM stdin;
04283c6a-f803-44cc-9835-de943c7c14d0	a5dd6c7a-180f-4237-9473-aa3a7b8318e8	930c50ac-68ad-4bde-afca-a1bb0f25f9a6	5ae0dd5e-a1cb-41fe-ab36-07a99067a3b5	25.000	2026-09-20 07:53:11.495413	2026-09-20 07:53:11.495413
d51b5674-ab63-451c-8c11-c124e64f87a1	59b0d497-2b3b-4ff5-a93d-cf7438fc2f8f	1bc5044e-4766-4afd-a63d-00ff2f3bf41f	4f568a4a-19f4-4035-8835-472bed6f0a8d	30.000	2026-09-20 07:54:43.44795	2026-09-20 07:54:43.44795
374e12d2-4d2f-4e3a-b054-7566de380047	28b991ca-18ad-4f6a-b90b-3c78742edac3	d338f707-f6d3-4947-9753-8e2ec26ed2b1	b775e2d8-e4f7-4f09-809d-6ba4b6971249	30.000	2026-09-20 07:55:09.073145	2026-09-20 07:55:09.073145
54ec87c9-21db-4253-8f79-2d9f9bd380f6	5379de2b-36e1-43e2-9617-c670db5145f8	376cb188-8c8c-4045-9fc8-cd570e900276	0e1aa7e1-ca16-4e55-aecc-b5ef1fd12617	30.000	2026-09-20 07:55:20.811475	2026-09-20 07:55:20.811475
2f691061-b11e-422d-97d0-458dc12fa2e5	36add03c-53a8-4e6f-ad6d-b43d56e6820a	c86d3632-78bb-479b-8535-07766e672c4e	63dc2ed2-cc55-45da-bf81-48e2c184fc16	30.000	2026-09-20 07:55:49.535261	2026-09-20 07:55:49.535261
0f89d6c8-8bc4-4592-9cba-25d57bfb112b	6fb7376b-3b70-40e8-975c-524510dc95c5	\N	63dc2ed2-cc55-45da-bf81-48e2c184fc16	18.000	2026-09-20 07:55:49.519326	2026-09-20 08:59:06.893256
17a4abce-d44d-45aa-8811-3b7d0f2b61ed	3bc3c30a-b8d6-4627-a1fc-911999d19c3a	41916d2d-b6d3-4d42-a549-be81cbc5a119	5ae0dd5e-a1cb-41fe-ab36-07a99067a3b5	10.000	2026-09-20 11:10:55.024561	2026-09-20 11:10:55.024561
422d3f81-5893-4fc6-80f9-0a0f3c06c0a8	00e60628-471c-489d-b1d4-6107555228be	63b46e7b-8d5e-4266-acf9-77c6663cb664	4a17737f-a74b-4b2b-98db-3408bdba51cd	15.000	2026-09-20 11:16:18.060178	2026-09-20 11:16:18.060178
2e99473f-4fad-4719-b879-5675a2540bce	00e60628-471c-489d-b1d4-6107555228be	b4aa37b8-4571-4477-8f1d-749bda871c8d	4a17737f-a74b-4b2b-98db-3408bdba51cd	10.000	2026-09-20 11:16:18.060178	2026-09-20 11:16:18.060178
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: Vynn82
--

COPY public.suppliers (id, code, name, contact_person, phone, email, address, is_active, created_at, updated_at) FROM stdin;
e6fdb4e4-107a-43c9-955f-22ae3736ee26	SUP-83342	Test Supplier SUP-83342	Tester Jane	012345678	supplier-83342@example.com	\N	t	2026-09-20 07:54:43.34758	2026-09-20 07:54:43.37626
0f688165-b0f5-48df-ac1a-0912a32f96b2	SUP-20727	Test Supplier SUP-20727	Tester Jane	012345678	supplier-20727@example.com	\N	t	2026-09-20 07:55:20.73184	2026-09-20 07:55:20.758653
9e977937-f74f-45fa-9d0f-9d39183910d4	SUP-49329	Test Supplier SUP-49329	Tester Jane	012345678	supplier-49329@example.com	\N	t	2026-09-20 07:55:49.334753	2026-09-20 07:55:49.361872
305a8720-5262-4ffa-a08e-b609329b94d8	TECH-HUB-ASIA	Tech Hub Asia Distribution	David Lim	+85523888999	orders@techhubasia.com	Phnom Penh, Cambodia	t	2026-09-20 10:04:17.593309	2026-09-20 10:04:17.593309
2c3541ac-68f7-4a52-885e-51a6d66a2dba	SUP-08990	Test Supplier SUP-08990	David Lim (VP Sales)	012345678	supplier-08990@example.com	\N	t	2026-09-20 07:55:08.993954	2026-09-20 10:04:17.871659
70a080d9-d1d7-424d-8273-5c21cf5f0256	GLOBAL-TECH	Global Tech International	John Doe	+85512345678	supplier@globaltech.com	\N	t	2026-09-20 11:14:09.296972	2026-09-20 11:14:09.296972
\.


--
-- Data for Name: user_profiles; Type: TABLE DATA; Schema: public; Owner: Vynn82
--

COPY public.user_profiles (id, user_id, first_name, last_name, email, phone, telegram_chat_id, avatar, created_at, updated_at) FROM stdin;
2c51e20f-24ae-45d5-b8f7-78424087064c	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	System	Administrator	admin@gmail.com	\N	\N	\N	2026-08-29 14:54:26.479439	2026-08-29 14:54:26.479439
7514fd3d-1a65-460f-a516-108f43cb330d	693a56ed-5436-4756-ba32-ff09e691fbfd	Ri	Da	irp2025230014@ppiu.edu.kh	012345678	123456789	https://ui-avatars.com/api/?name=RD&background=random	2026-08-31 14:45:31.145315	2026-08-31 14:45:31.145315
5d77619b-0e6d-49bd-bace-eb8652d16d47	ba5249c1-bcd2-4647-9206-145a3f73c45c	Ni	Ta	mrbookchouch@gmail.com	012345678	123456789	https://ui-avatars.com/api/?name=NT&background=random	2026-09-04 15:02:15.842732	2026-09-04 15:02:15.842732
93d7d0ee-531c-44f0-9c9c-fa04ead86af9	1b5e9619-67e1-436a-b494-482acb94bffa	Ri	Ta	nice@gmail.com	012345678	123456789	https://ui-avatars.com/api/?name=RT&background=random	2026-09-04 15:21:10.687665	2026-09-04 15:21:10.687665
7e485625-e31e-458a-b5e2-c2f581c6536e	6a68754f-5511-4927-b46b-86796d1acecb	Mo	Lika	molikakhorn71@gmail.com	012345678	123456789	https://ui-avatars.com/api/?name=ML&background=random	2026-09-05 07:25:24.507535	2026-09-05 07:25:24.507535
c0a78012-17ac-4c75-ad2e-4d2b4ca984fd	d31112fb-f5ec-40a4-812c-b11a1a26c55f	Ay	Heng	namayheng12345@gmail.com	01233333	\N	https://ui-avatars.com/api/?name=AH&background=random	2026-09-05 08:46:14.842157	2026-09-05 08:46:14.842157
6376a338-48b2-42f7-af85-a1df54245346	5793e789-f952-4f09-a962-6ca01b9ac0b8	Vi	Sal	khemvisal885@gmail.com	012345678	123456789	https://ui-avatars.com/api/?name=VS&background=random	2026-09-12 06:49:53.861316	2026-09-12 06:49:53.861316
94504b14-1b8c-4244-a5df-c4fd7006039d	d2b6f1c1-477c-436c-b2cf-a1bc70e7f3b8	Vin	28	hemtheavin5@gmail.com	012345678	123456789	https://ui-avatars.com/api/?name=V2&background=random	2026-09-12 06:52:20.090142	2026-09-12 06:52:20.090142
01512e03-c02b-4461-ba44-07b2c4d00a44	9cfec689-84ef-4902-a431-d57903523680	Sok	Dara	newstaff@company.com	+85512999888	\N	https://ui-avatars.com/api/?name=SD&background=random	2026-09-20 10:03:59.225125	2026-09-20 10:03:59.225125
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: Vynn82
--

COPY public.user_roles (id, user_id, role_id) FROM stdin;
f3555269-c450-474f-983c-893a5ce1c560	7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	177b15c4-ff66-4ac5-b854-3d8ac47d57ba
880bfe9c-473d-47ec-87c6-f58a66923396	ba5249c1-bcd2-4647-9206-145a3f73c45c	5ae82eea-9f46-489e-8486-1dcf09427e9a
69613f55-21fa-4b79-9f32-63abfc33b781	1b5e9619-67e1-436a-b494-482acb94bffa	5ae82eea-9f46-489e-8486-1dcf09427e9a
bd95d038-f76b-40e9-9fe2-c5ae56510404	6a68754f-5511-4927-b46b-86796d1acecb	5ae82eea-9f46-489e-8486-1dcf09427e9a
f8bc07d7-a388-4fab-912b-85f839243d60	d31112fb-f5ec-40a4-812c-b11a1a26c55f	5ae82eea-9f46-489e-8486-1dcf09427e9a
d073a4b7-446f-4cbf-89b9-23c77a733566	5793e789-f952-4f09-a962-6ca01b9ac0b8	5ae82eea-9f46-489e-8486-1dcf09427e9a
4e9485aa-b14a-45e7-89b9-ab4aba31308b	d2b6f1c1-477c-436c-b2cf-a1bc70e7f3b8	5ae82eea-9f46-489e-8486-1dcf09427e9a
75063333-3f35-450b-9521-bc4aca1b32d0	693a56ed-5436-4756-ba32-ff09e691fbfd	64c41181-8b90-4b82-89eb-6fc84749d2a3
8fa7025f-d5fd-4352-b487-c1dcd5dd85c8	9cfec689-84ef-4902-a431-d57903523680	5ae82eea-9f46-489e-8486-1dcf09427e9a
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: Vynn82
--

COPY public.users (id, staff_id, password_hash, status, must_change_password, created_by, last_login_at, created_at, updated_at) FROM stdin;
6a68754f-5511-4927-b46b-86796d1acecb	KH0005	$2b$12$XO91P/Rg8NfNdEV0tq/XA.dnUmo93YYYocziuXLuWn8y7p8nZK7EC	ACTIVE	f	\N	2026-09-05 20:14:28.478	2026-09-05 07:25:24.507535	2026-09-05 13:14:28.479901
7f45d8be-13eb-4f6b-b3a0-d1e85d1cae1c	KH0001	$2b$12$JDKI6fjrhdFR7BH4hAhoQeqZ.RBPsnzGm79B8IBUcaWtBI7dWrO.G	ACTIVE	f	\N	2026-09-20 18:21:46.812	2026-08-29 14:54:26.479439	2026-09-20 11:21:46.814878
693a56ed-5436-4756-ba32-ff09e691fbfd	KH0002	$2b$12$5FddS4.WFEnaFx0bXc6ceu/hOzhn2shhZTbMso1UjcS.76UrFVwoa	ACTIVE	f	\N	2026-09-20 15:59:06.793	2026-08-31 14:45:31.145315	2026-09-20 08:59:06.794853
1b5e9619-67e1-436a-b494-482acb94bffa	KH0004	$2b$12$ml/RBfowjalPzHxzK1Xwqeme3f5vXRUqT.Nawnp.sMIOaP9J73/5O	ACTIVE	f	\N	2026-09-09 21:36:47.583	2026-09-04 15:21:10.687665	2026-09-09 14:36:47.586077
d31112fb-f5ec-40a4-812c-b11a1a26c55f	KH0006	$2b$12$.ZTo7DJneAmchG5.b47gsO4inBW9CS.Ev/z7V/xlT9kYQ7raSz7ZS	ACTIVE	t	\N	\N	2026-09-05 08:46:14.842157	2026-09-05 08:46:14.842157
5793e789-f952-4f09-a962-6ca01b9ac0b8	KH0007	$2b$12$xOzUhUR2AvfIGvD2E4sM1u4128GVmnQDQ9HiPmXd1Mddpn4TPpXm.	ACTIVE	t	\N	\N	2026-09-12 06:49:53.861316	2026-09-12 06:49:53.861316
d2b6f1c1-477c-436c-b2cf-a1bc70e7f3b8	KH0008	$2b$12$soZjm2uO6JwWXV.BmNcC/ueNQCb9X/mHT1oQqTsec307OV8Asg.jC	ACTIVE	t	\N	\N	2026-09-12 06:52:20.090142	2026-09-12 06:52:20.090142
9cfec689-84ef-4902-a431-d57903523680	KH0009	$2b$12$Sibz8IDNH./toBXS87e2WOgUb.qeftSHDksJxAcGtIOJLf53EONve	ACTIVE	t	\N	\N	2026-09-20 10:03:59.225125	2026-09-20 10:03:59.225125
ba5249c1-bcd2-4647-9206-145a3f73c45c	KH0003	$2b$12$nkeYAlgdVMUdHO8okWckzOsTrg9Sb0DT.os3RIo2bmkxOj5BNFXvu	ACTIVE	f	\N	2026-09-12 15:53:15.536	2026-09-04 15:02:15.842732	2026-09-12 08:53:15.542537
\.


--
-- Data for Name: warehouses; Type: TABLE DATA; Schema: public; Owner: Vynn82
--

COPY public.warehouses (id, code, name, description, address, latitude, longitude, contact_person, phone, is_active, created_at, updated_at) FROM stdin;
29593af8-22ab-426c-9f34-23ca25028de2	WH002	Siem Reap Warehouse	Regional inventory warehouse	Siem Reap, Cambodia	13.3633000	103.8564000	Dara	098765432	t	2026-08-31 14:43:21.871029	2026-08-31 14:43:21.871029
4f568a4a-19f4-4035-8835-472bed6f0a8d	WH-83379	Test Warehouse WH-83379	\N	456 Secondary Blvd	\N	\N	Manager Dave	098765432	t	2026-09-20 07:54:43.3844	2026-09-20 07:54:43.422603
b775e2d8-e4f7-4f09-809d-6ba4b6971249	WH-09024	Test Warehouse WH-09024	\N	456 Secondary Blvd	\N	\N	Manager Dave	098765432	t	2026-09-20 07:55:09.028711	2026-09-20 07:55:09.055292
0e1aa7e1-ca16-4e55-aecc-b5ef1fd12617	WH-20761	Test Warehouse WH-20761	\N	456 Secondary Blvd	\N	\N	Manager Dave	098765432	t	2026-09-20 07:55:20.765378	2026-09-20 07:55:20.794004
63dc2ed2-cc55-45da-bf81-48e2c184fc16	WH-49364	Test Warehouse WH-49364	\N	456 Secondary Blvd	\N	\N	Manager Dave	098765432	t	2026-09-20 07:55:49.368406	2026-09-20 07:55:49.396914
ebe49bd4-fc2a-489e-bcd0-fa4a9b64e0e7	WH-NORTH	North Logistics Center	\N	Sen Sok, Phnom Penh	\N	\N	Chan Vanna	+85512777666	t	2026-09-20 10:04:18.163762	2026-09-20 10:04:18.163762
5ae0dd5e-a1cb-41fe-ab36-07a99067a3b5	WH001	North Central Logistics Depot	Main inventory warehouse	Phnom Penh, Cambodia	11.5564000	104.9282000	John	012345678	t	2026-08-31 14:43:10.839413	2026-09-20 10:04:18.438275
4a17737f-a74b-4b2b-98db-3408bdba51cd	WH-MAIN	Main Central Warehouse	Primary headquarters logistics hub	Phnom Penh, Cambodia	\N	\N	\N	\N	t	2026-09-20 11:14:09.296972	2026-09-20 11:14:09.296972
\.


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: Vynn82
--

SELECT pg_catalog.setval('public.migrations_id_seq', 28, true);


--
-- Name: staff_id_seq; Type: SEQUENCE SET; Schema: public; Owner: Vynn82
--

SELECT pg_catalog.setval('public.staff_id_seq', 9, true);


--
-- Name: mails PK_218248d7dfe1b739f06e2309349; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.mails
    ADD CONSTRAINT "PK_218248d7dfe1b739f06e2309349" PRIMARY KEY (id);


--
-- Name: sessions PK_3238ef96f18b355b671619111bc; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY (id);


--
-- Name: menus PK_3fec3d93327f4538e0cbd4349c4; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.menus
    ADD CONSTRAINT "PK_3fec3d93327f4538e0cbd4349c4" PRIMARY KEY (id);


--
-- Name: migrations PK_8c82d7f526340ab734260ea46be; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);


--
-- Name: approvers PK_approvers; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.approvers
    ADD CONSTRAINT "PK_approvers" PRIMARY KEY (id);


--
-- Name: stocks PK_b5b1ee4ac914767229337974575; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.stocks
    ADD CONSTRAINT "PK_b5b1ee4ac914767229337974575" PRIMARY KEY (id);


--
-- Name: brands PK_brands; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT "PK_brands" PRIMARY KEY (id);


--
-- Name: categories PK_categories; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT "PK_categories" PRIMARY KEY (id);


--
-- Name: role_menus PK_efd7de02124423e1c2960df3ab4; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.role_menus
    ADD CONSTRAINT "PK_efd7de02124423e1c2960df3ab4" PRIMARY KEY (id);


--
-- Name: permissions PK_permissions_id; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT "PK_permissions_id" PRIMARY KEY (id);


--
-- Name: product_variants PK_product_variants; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT "PK_product_variants" PRIMARY KEY (id);


--
-- Name: products PK_products; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "PK_products" PRIMARY KEY (id);


--
-- Name: request_items PK_request_items; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.request_items
    ADD CONSTRAINT "PK_request_items" PRIMARY KEY (id);


--
-- Name: requests PK_requests; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT "PK_requests" PRIMARY KEY (id);


--
-- Name: role_permissions PK_role_permissions; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT "PK_role_permissions" PRIMARY KEY (id);


--
-- Name: roles PK_roles_id; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT "PK_roles_id" PRIMARY KEY (id);


--
-- Name: stock_adjustments PK_stock_adjustments; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT "PK_stock_adjustments" PRIMARY KEY (id);


--
-- Name: suppliers PK_suppliers; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT "PK_suppliers" PRIMARY KEY (id);


--
-- Name: user_profiles PK_user_profiles_id; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT "PK_user_profiles_id" PRIMARY KEY (id);


--
-- Name: user_roles PK_user_roles_id; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT "PK_user_roles_id" PRIMARY KEY (id);


--
-- Name: users PK_users_id; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_users_id" PRIMARY KEY (id);


--
-- Name: warehouses PK_warehouses; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT "PK_warehouses" PRIMARY KEY (id);


--
-- Name: menus UQ_a8bb3519a45e021a147bc87e49a; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.menus
    ADD CONSTRAINT "UQ_a8bb3519a45e021a147bc87e49a" UNIQUE (name);


--
-- Name: approvers UQ_approvers_request_step; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.approvers
    ADD CONSTRAINT "UQ_approvers_request_step" UNIQUE (request_id, step);


--
-- Name: brands UQ_brands_code; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT "UQ_brands_code" UNIQUE (code);


--
-- Name: brands UQ_brands_name; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT "UQ_brands_name" UNIQUE (name);


--
-- Name: categories UQ_categories_code; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT "UQ_categories_code" UNIQUE (code);


--
-- Name: categories UQ_categories_name; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT "UQ_categories_name" UNIQUE (name);


--
-- Name: permissions UQ_permissions_name; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT "UQ_permissions_name" UNIQUE (name);


--
-- Name: product_variants UQ_product_variants_barcode; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT "UQ_product_variants_barcode" UNIQUE (barcode);


--
-- Name: product_variants UQ_product_variants_sku; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT "UQ_product_variants_sku" UNIQUE (sku);


--
-- Name: products UQ_products_barcode; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "UQ_products_barcode" UNIQUE (barcode);


--
-- Name: products UQ_products_code; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "UQ_products_code" UNIQUE (code);


--
-- Name: products UQ_products_sku; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "UQ_products_sku" UNIQUE (sku);


--
-- Name: requests UQ_requests_request_no; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT "UQ_requests_request_no" UNIQUE (request_no);


--
-- Name: role_menus UQ_role_menus_role_menu; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.role_menus
    ADD CONSTRAINT "UQ_role_menus_role_menu" UNIQUE (role_id, menu_id);


--
-- Name: role_permissions UQ_role_permissions_role_permission; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT "UQ_role_permissions_role_permission" UNIQUE (role_id, permission_id);


--
-- Name: roles UQ_roles_name; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT "UQ_roles_name" UNIQUE (name);


--
-- Name: suppliers UQ_suppliers_code; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT "UQ_suppliers_code" UNIQUE (code);


--
-- Name: suppliers UQ_suppliers_name; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT "UQ_suppliers_name" UNIQUE (name);


--
-- Name: user_profiles UQ_user_profiles_email; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT "UQ_user_profiles_email" UNIQUE (email);


--
-- Name: user_profiles UQ_user_profiles_user_id; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT "UQ_user_profiles_user_id" UNIQUE (user_id);


--
-- Name: user_roles UQ_user_roles_user_role; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT "UQ_user_roles_user_role" UNIQUE (user_id, role_id);


--
-- Name: users UQ_users_staff_id; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_users_staff_id" UNIQUE (staff_id);


--
-- Name: warehouses UQ_warehouses_code; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT "UQ_warehouses_code" UNIQUE (code);


--
-- Name: warehouses UQ_warehouses_name; Type: CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT "UQ_warehouses_name" UNIQUE (name);


--
-- Name: IDX_approvers_request_id; Type: INDEX; Schema: public; Owner: Vynn82
--

CREATE INDEX "IDX_approvers_request_id" ON public.approvers USING btree (request_id);


--
-- Name: IDX_approvers_user_id; Type: INDEX; Schema: public; Owner: Vynn82
--

CREATE INDEX "IDX_approvers_user_id" ON public.approvers USING btree (user_id);


--
-- Name: IDX_request_items_product_code; Type: INDEX; Schema: public; Owner: Vynn82
--

CREATE INDEX "IDX_request_items_product_code" ON public.request_items USING btree (product_code);


--
-- Name: IDX_request_items_request_id; Type: INDEX; Schema: public; Owner: Vynn82
--

CREATE INDEX "IDX_request_items_request_id" ON public.request_items USING btree (request_id);


--
-- Name: IDX_request_items_variant_code; Type: INDEX; Schema: public; Owner: Vynn82
--

CREATE INDEX "IDX_request_items_variant_code" ON public.request_items USING btree (variant_code);


--
-- Name: IDX_requests_request_type; Type: INDEX; Schema: public; Owner: Vynn82
--

CREATE INDEX "IDX_requests_request_type" ON public.requests USING btree (request_type);


--
-- Name: IDX_requests_requester_id; Type: INDEX; Schema: public; Owner: Vynn82
--

CREATE INDEX "IDX_requests_requester_id" ON public.requests USING btree (requester_id);


--
-- Name: IDX_requests_status; Type: INDEX; Schema: public; Owner: Vynn82
--

CREATE INDEX "IDX_requests_status" ON public.requests USING btree (status);


--
-- Name: IDX_sessions_user_id; Type: INDEX; Schema: public; Owner: Vynn82
--

CREATE INDEX "IDX_sessions_user_id" ON public.sessions USING btree (user_id);


--
-- Name: IDX_stock_adjustments_adjusted_by_id; Type: INDEX; Schema: public; Owner: Vynn82
--

CREATE INDEX "IDX_stock_adjustments_adjusted_by_id" ON public.stock_adjustments USING btree (adjusted_by_id);


--
-- Name: IDX_stock_adjustments_product_id; Type: INDEX; Schema: public; Owner: Vynn82
--

CREATE INDEX "IDX_stock_adjustments_product_id" ON public.stock_adjustments USING btree (product_id);


--
-- Name: IDX_stock_adjustments_request_id; Type: INDEX; Schema: public; Owner: Vynn82
--

CREATE INDEX "IDX_stock_adjustments_request_id" ON public.stock_adjustments USING btree (request_id);


--
-- Name: IDX_stock_adjustments_variant_id; Type: INDEX; Schema: public; Owner: Vynn82
--

CREATE INDEX "IDX_stock_adjustments_variant_id" ON public.stock_adjustments USING btree (variant_id);


--
-- Name: IDX_stock_adjustments_warehouse_id; Type: INDEX; Schema: public; Owner: Vynn82
--

CREATE INDEX "IDX_stock_adjustments_warehouse_id" ON public.stock_adjustments USING btree (warehouse_id);


--
-- Name: sessions FK_085d540d9f418cfbdc7bd55bb19; Type: FK CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: stocks FK_a9773f4dd739dc4fc7d4644f932; Type: FK CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.stocks
    ADD CONSTRAINT "FK_a9773f4dd739dc4fc7d4644f932" FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: approvers FK_approvers_request; Type: FK CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.approvers
    ADD CONSTRAINT "FK_approvers_request" FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE CASCADE;


--
-- Name: stocks FK_b9acd455e80b402a2058d11ef46; Type: FK CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.stocks
    ADD CONSTRAINT "FK_b9acd455e80b402a2058d11ef46" FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: stocks FK_cdcdc9a4b531cbd24c06bc4f9e7; Type: FK CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.stocks
    ADD CONSTRAINT "FK_cdcdc9a4b531cbd24c06bc4f9e7" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: menus FK_menus_parent; Type: FK CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.menus
    ADD CONSTRAINT "FK_menus_parent" FOREIGN KEY (parent_id) REFERENCES public.menus(id) ON DELETE CASCADE;


--
-- Name: product_variants FK_product_variants_product; Type: FK CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT "FK_product_variants_product" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products FK_products_brand; Type: FK CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "FK_products_brand" FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: products FK_products_category; Type: FK CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "FK_products_category" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE RESTRICT;


--
-- Name: products FK_products_supplier; Type: FK CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "FK_products_supplier" FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: request_items FK_request_items_request; Type: FK CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.request_items
    ADD CONSTRAINT "FK_request_items_request" FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE CASCADE;


--
-- Name: requests FK_requests_requester; Type: FK CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT "FK_requests_requester" FOREIGN KEY (requester_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: role_menus FK_role_menus_menu; Type: FK CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.role_menus
    ADD CONSTRAINT "FK_role_menus_menu" FOREIGN KEY (menu_id) REFERENCES public.menus(id) ON DELETE CASCADE;


--
-- Name: role_menus FK_role_menus_role; Type: FK CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.role_menus
    ADD CONSTRAINT "FK_role_menus_role" FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: role_permissions FK_role_permissions_permission; Type: FK CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT "FK_role_permissions_permission" FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions FK_role_permissions_role; Type: FK CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT "FK_role_permissions_role" FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: stock_adjustments FK_stock_adjustments_adjusted_by; Type: FK CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT "FK_stock_adjustments_adjusted_by" FOREIGN KEY (adjusted_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: stock_adjustments FK_stock_adjustments_product; Type: FK CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT "FK_stock_adjustments_product" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock_adjustments FK_stock_adjustments_request; Type: FK CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT "FK_stock_adjustments_request" FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE CASCADE;


--
-- Name: stock_adjustments FK_stock_adjustments_variant; Type: FK CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT "FK_stock_adjustments_variant" FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: stock_adjustments FK_stock_adjustments_warehouse; Type: FK CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT "FK_stock_adjustments_warehouse" FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: user_profiles FK_user_profiles_user; Type: FK CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT "FK_user_profiles_user" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_roles FK_user_roles_role; Type: FK CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT "FK_user_roles_role" FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles FK_user_roles_user; Type: FK CONSTRAINT; Schema: public; Owner: Vynn82
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT "FK_user_roles_user" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 0ba3KQhn0vxVNVBFRLnnfXnpuNKHW0mcDTBvYkjkdDqqJk445s1Psmq3cZUj5eC

