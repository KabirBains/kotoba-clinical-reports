import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Embedded style guide ────────────────────────────────────
const STYLE_GUIDE = `FCA CLINICAL WRITING STYLE GUIDE
Comprehensive Pattern Library — Extracted from 5 Accepted NDIS FCA Reports
Professor Nhunzvi | Glenn, Jose, Daniel, Lenore, Esther
This document is loaded by the generate-report and refine-report edge functions as the authoritative writing voice reference. Every example below was extracted verbatim from reports accepted by NDIS planners. The AI must match this voice. Reuse of proven clinical language across participants is expected and encouraged — what changes is the participant-specific detail, not the structural language.
1. Formal Introduction Pattern
Every report opens with a formal name in the Reason for Referral, then first name only throughout.

2. Introduction Paragraphs — Lead with the person
Open with age, personality, location, family. Diagnosis in paragraph 2 or 3. Interests and strengths early.

Glenn — psychosocial disability, adult male
Jose — psychosocial disability, cultural context
Daniel — complex psychosocial, SIL
Lenore — progressive physical disability
Esther — paediatric, developmental delay

3. Urgency and Risk Framing
Used early in the report to establish the clinical imperative for supports.

4. Home Environment — Concrete observations
Name what was seen. Describe the physical layout, then the condition, then the clinical implication.

5. Self-Care Domain — Pattern library
These paragraphs can be adapted for any participant with self-care limitations. Change the name and participant-specific details.

6. Life Activities / Household Domain

7. Communication Domain

8. Social / Getting Along Domain

9. Cognition Domain

10. Mobility Domain

11. LSP-16 Interpretation — Correct scoring direction

Lenore — Low scores (good functioning)
Jose — Moderate-high scores (significant impairment)
Daniel — High scores (severe impairment)

12. Consequence Statements — Complete library
51 consequence statements extracted from all 5 reports. Adapt for any participant by changing the name and specific risks.

Glenn (17 statements)
Jose (10 statements)
Daniel (14 statements)
Lenore (4 statements)
Esther (6 statements)

13. Collateral Integration Examples

14. Verb Preferences and Banned Constructions

USE for limitations: 'requires', 'is unable to', 'cannot', 'does not', 'fails to', 'has been observed to', 'struggles to', 'lacks'.
USE for strengths: 'retains', 'is able to', 'maintains', 'engages', 'continues to', 'benefits from', 'values'.
USE for observations: 'was observed to', 'presented with', 'the assessor noted', 'the assessor observed'.

15. Sentence Architecture
Professor's reports: average 21 words/sentence. 15% of sentences under 12 words. 10% over 30 words.

Short for impact: 'Structured routines are essential.' 'He cannot cook unsupervised.' 'Daily support is essential for personal hygiene.' 'There are no physical barriers.' 'Glenn lives alone.'
Medium for observation: 'These tasks are taking significantly longer and are becoming inconsistent, which may compromise his hygiene, health, and overall safety.'
Long for clinical explanation (max 35 words): 'His psychosocial disability, and behavioural challenges prevent him from functioning in structured learning or vocational settings without intensive, individualised support and supervision.'

[Lenore]
Ms. Lenore Kay Kononen (referred to as Lenore for the remainder of the report) was referred to Dr Clement Nhunzvi Occupational Therapy on 13/01/2026 by Omole Eruanga, Truelink Community Services. The purpose of the referral was for a Functional Capacity Assessment to review her current overall functioning, daily living skills, and support needs, providing information for her NDIS plan review and change of circumstances application. The recommendations of this report aim to reduce the impact of her disability.
[Jose]
Mr. Jose Madeira SOARES (referred to as Jose for the remainder of the report) was referred to Life Prospects Consulting by his Support Coordinator.
[Daniel]
Mr. Daniel LAM (referred to as Daniel for the remainder of the report) was referred to Life Prospects Consulting by his Support Coordinator.
[Esther]
Ms. Esther Mutanda (referred to as Esther for the remainder of the report) was referred to Dr Clement Nhunzvi Occupational Therapy on 03/12/2025 by Omole Eruanga, Truelink Community Services. The purpose of the referral was for a Functional Capacity Assessment to review her current overall functioning, daily living skills, and support needs, providing information for her NDIS plan review. The recommendations of this report aim to reduce the impact of her disability.
RULE: Full name appears ONCE in the formal introduction with Mr./Ms. prefix and surname in CAPITALS. ALL subsequent references use first name only. Never repeat the full name.
[Glenn]
Glenn is a 63-year-old man who has lived in Darwin for approximately five years. He places high value on his independence and maintaining social connections. Glenn was born in Charleville, Queensland. According to previous reports, his parents separated when he was four years old. He is the second of three siblings (all boys). Glenn was raised by his father in Katherine, where he attended primary school and continued through to Year 11. The current whereabouts of his siblings and extended family members are unknown. Rumours have it that they are in Brisbane, and Glenn shared the same, though he has no contact with them.
[Glenn]
About three decades ago, Glenn was reported to be a high functioning and independent young man, he even used to be in full time employment as a qualified Linesman and Cable Joiner. All was disrupted following a workplace accident in which he sustained traumatic head injury. Glenn then in an effort to adapt and cope with the pain, he turned to illicit substances, which have been cited as triggers to the onset of his mental illness. He has experienced frequent relapses and hospitalisations to date.
[Glenn]
Throughout his life, Glenn has experienced significant adverse events, including traumatic childhood experiences, abuse, disability-related challenges, poor mental health, substance use, and periods of housing instability and homelessness. These experiences have had a lasting impact on his emotional well-being, social participation, and overall functional capacity.
[Jose]
Jose is a 58-year-old male of East Timorese origin. He has a mental health and psychosocial disability, primarily secondary to Schizophrenia that was diagnosed in 1995. Jose's life has been marked by instability, fractured relationships, and escalating behavioural concerns that necessitate a structured, and multi-disciplinary support to his care. He reports of having some relatives around Darwin; however, they have strained relationships and rarely has any meaningful contact with them.
[Jose]
Jose has established interests in current affairs, political issues and political history, sociology and computer science. His past employment history involved working as a cleaner, a general hand and as a taxi driver.
[Jose]
Jose's primary diagnosis on NDIS is Schizophrenia. This condition is characterised by deficits in social interactions, cognitive impairments compounded by psychotic symptoms such as delusions, hallucinations, limited engagement in self-care daily routines, restricted interests and the ability to adapt to different situations, which are evident in Jose's reported and noted support needs.
[Daniel]
Daniel is a 44-year-old male living with a psychosocial disability that significantly impacts his daily functioning, safety, and ability to engage in meaningful activities. His primary diagnoses include Schizophrenia and substance-induced psychosis, which present with severe symptoms such as auditory and visual hallucinations, delusional thinking, and disordered thought processes. These symptoms are frequently exacerbated by illicit substance use. Daniel is also suspected to have Antisocial Personality Disorder (as indicated by the psychiatrist).
[Daniel]
Daniel's interests include watching television, particularly sports. He enjoys spending time in his bedroom listening to music. Daniel also enjoys exploring the outdoors, enjoying short walks and going on drives. However, participation is inconsistent and dependent on behavioural stability and risk management.
[Daniel]
Daniel is of Chinese and Timorese heritage; Daniel's father was from Hong Kong and Daniel's mother is from Timor Leste. Daniel grew up in the Darwin area with his father, his mother and his siblings. Daniel has always lived in Darwin his entire life.
[Lenore]
Lenore is a 67-year-old jovial woman who lives in Darwin. She is retired administrator and a mother of two adult children. Her son is married and lives in Darwin with his family, whilst her daughter lives in Adelaide. Her daughter is a widow and stays together with her five sons. Lenore has a respectful and loving relationship with her children and grandchildren. However, her informal supports are too committed and cannot assist with ongoing carer support.
[Lenore]
She was diagnosed of a spinocerebellar degenerative ataxia almost three years ago, which has resulted in substantial neuromuscular impairment and disability. Lenore presents with moderate and progressive participation restriction, well pronounced in her mobility, self-care and social well-being.
[Lenore]
Over the past 12 months, Lenore has experienced a significant deterioration in her physical functioning because of her progressive neurological condition. There has been a marked decline in her posture, gait, balance, as well as gross and fine motor skills.
[Esther]
Esther is a 10-year-old girl who resides in Zuccoli, Palmerston with her mother, Leatycia, and three siblings: Gopal, Andrew, and Moseis. She is currently in Year 5 at Zuccoli Primary School. Esther's family is of African cultural background, originally from Congo, and she communicates in both English and Lingala.
[Esther]
Esther's mother, Leatycia, is a single parent with no extended family supports in Australia. She works as a support worker in Supported Independent Living (SIL) housing, assisting teenagers with disabilities and challenging behaviours. Esther's father has been absent for nearly ten years due to stigma-related issues and has had no contact with the family during this time.
[Esther]
Leatycia provides full care for Esther, including all personal care tasks, and also supports her son Moseis, who has a diagnosis of Autism Spectrum Disorder (Level 3) and Attention-Deficit Hyperactivity Disorder. Moseis attends Nemarluk Special Education School. Due to these significant caregiving responsibilities, Leatycia experiences high levels of carer burnout and requires substantial support.
[Esther]
Esther enjoys playing with her barbie dolls, watching TV and playing on the iPad. Though she displays passion in her interests, she can become fixated on her birthday, social media videos and religious matters.
[Jose]
Due to his complex disabilities, Jose is at high risk of experiencing rapid decline in emotional, psychosocial well-being, physical and mental health. Therefore, it is imperative for Jose to receive formal ongoing support through an Independent Living Support program to improve safety and maintain current functional capacity and participation in day-to-day activities at home.
[Daniel]
Due to his complex disabilities, Daniel is at high risk of experiencing rapid decline in emotional, psychosocial well-being, physical and mental health. Therefore, it is imperative for him to receive formal ongoing support through an Independent Living Support program to improve safety and maintain current functional capacity and participation in day-to-day activities.
[Lenore]
Lenore has difficulty maintaining prolonged periods of standing, has significant and progressive impairment of dynamic balance and cannot walk without aids. Her disability significantly affects her ability to independently engage in community and household tasks. She requires support care worker to provide substantial assistance, such as preparing her meals, setting up and cleaning the bath, household chores, domestic tasks and community participation.
[Glenn]
Glenn lives alone in the Darwin CBD in a one-bedroom unit provided through the Territory Housing Scheme. During a home visit, the assessor observed that the property was in significant disrepair due to longstanding maintenance issues, neglect, and the overall age of the dwelling. Glenn sleeps on an old, heavily soiled, and structurally compromised bed in the lounge.
[Jose]
Jose is receiving NDIS support through Helping People Achieve (HPA). Jose's apartment is on the third floor of the housing commission building with 6 sets of stairs to reach the floor. The unit is a 2-bedroom unit with an open plan kitchen and dining area. It has functional toilet and bathroom to support Jose's needs. Home assessment and observation indicated that Jose is struggling to maintain household cleanliness and hygiene. The house had dirty dishes, clothes and floors. Jose reported his neighbours can often be loud and destructive of shared property. Jose's house walls were covered in posters of East Timorese and Vietnamese politicians and Catholic Doctrine.
[Daniel]
Daniel resides in a Supported Independent Living (SIL) accommodation with no other residents due to his challenging behaviours, namely physical and verbal aggression. The SIL house is a 3-bedroom house with a kitchen, bathroom, toilet and dining room. There are no physical barriers for Daniel to access personal needs in the house.
[Lenore]
Lenore currently lives alone in a three-bedroom, single-level unit located in Rosebery, Palmerston. The home comprises an open-plan kitchen, lounge, and dining area, and includes two bathrooms with toilets. Lenore's primary bedroom has an ensuite bathroom, which she predominantly uses for daily self-care activities. An occupational therapy home assessment has previously been completed, and minor home modifications have been implemented to support Lenore's mobility and transfer safety. These modifications include the installation of grab rails in the bathroom and toilet areas to assist with transfers and reduce fall risk. The main entrance to the home has also been modified to include an access ramp, enabling safer entry and exit when using mobility aids such as a walking frame or wheelchair.
[Lenore]
Despite these environmental supports, Lenore's progressive physical decline significantly limits her capacity to independently manage household tasks. She currently receives three (3) hours per week of NDIS-funded domestic assistance. This support is essential, as Lenore is unable to safely or consistently complete household cleaning, laundry, and dishwashing tasks due to reduced balance, strength, coordination, and endurance. Attempting these activities independently would place her at increased risk of falls, fatigue, and injury.
[Glenn]
Glenn requires prompts, reminders, and practical support to complete daily self-care tasks, including personal hygiene and grooming. Although he is generally able to dress and eat independently, these tasks are taking significantly longer and are becoming inconsistent, which may compromise his hygiene, health, and overall safety.
[Glenn]
He benefits from structured routines, periodic monitoring, and support to maintain independence in daily hygiene and grooming. Glenn also requires ongoing assistance with meal preparation, particularly when alone for extended periods. His support needs are best met in a supported independent living placement; however, the use of meal delivery services may assist in maintaining adequate nutrition and promote health and well-being in the interim.
[Jose]
Jose requires reminders, prompts and support to complete daily hygiene routines. While generally able to dress and eat independently, these activities are increasingly taking longer than typical and may compromise his health, safety and hygiene. He requires structured routines and periodic check-ins, and support to maintain independence. Jose also requires occasional support with meal preparation and monitoring dietary intake.
[Daniel]
Daniel requires reminders, prompts and supervision to complete hygiene routines. While he can dress and eat independently, these tasks take longer than typical, are usually poorly executed and compromises his health and safety. Structured routines and periodic check-ins are essential. He also needs support with meal preparation and monitoring dietary intake. Without this support, Daniel has been observed to go for days without basic personal hygiene.
[Lenore]
Lenore has a moderate level of difficulty with self-care activities, such as showering, dressing, and personal hygiene. While she is able to complete some tasks independently, her physical limitations, reduced balance, and fatigue impact the safety, efficiency, and consistency with which she can perform these activities. Support and environmental adaptations are required to reduce risk and maintain independence.
[Esther]
Esther experiences extreme difficulty with self-care tasks. She is unable to perform basic personal care activities independently and requires significant assistance for dressing, hygiene, toileting, and feeding. Structured routines and continuous supervision are essential to maintain safety and meet her daily needs. She benefits from ongoing occupational therapy as capacity building.
[Glenn]
Glenn's capacity to perform life activities is assessed within the severe range, indicating profound and pervasive impairments in managing productive work, daily routines, and household responsibilities. His disability, particularly his significant executive function deficits, substantially limits his ability to engage in productive tasks or maintain paid employment. He requires ongoing domestic assistance and capacity-building supports to maintain a safe, hygienic home environment and to develop sustainable routines for daily living.
[Jose]
Jose's ability to perform life activities is within the 'moderate' range. This indicates that he has deficits in performing household and life activities. Jose requires domestic support and capacity-building supports to maintain his home environment.
[Jose]
Jose demonstrates severe difficulty by non-participation in work or educational activities. His psychosocial disability, and behavioural challenges prevent him from functioning in structured learning or vocational settings without intensive, individualised support. He is unable to manage tasks independently and requires tailored programs and continuous supervision to participate meaningfully. He however has strong desire to reengage driving, his taxi business, and pursue computer technology-related vocations focused on his interests.
[Daniel]
Daniel's ability to perform life activities is within the 'severe' range. This indicates that he has significant deficits in performing household and life activities. He requires domestic assistance and capacity-building supports to maintain a safe and functional home environment.
[Daniel]
Daniel demonstrates extreme difficulty by non-participation in work or educational activities. He went up to year ten with significant behavioural concerns and used to work in a family restaurant business. However, his psychosocial disability, and behavioural challenges prevent him from functioning in structured learning or vocational settings without intensive, individualised support and supervision. He lacks both emotional and intellectual insight, has poor compliance to medication and has extreme impairment in decision making, problem solving and judgement, all of which are essential vocational skills.
[Lenore]
Lenore experiences severe limitations in managing household tasks, including cleaning, laundry, and meal-related activities. These difficulties are directly related to her reduced mobility, balance, endurance, and coordination. She is unable to safely or independently maintain her home environment without assistance, reinforcing the necessity of ongoing domestic support services.
[Lenore]
Lenore demonstrates extreme functional impairment in relation to work or study activities. Her physical limitations, fatigue, and progressive decline significantly restrict her capacity to engage in employment or education in a sustainable or safe manner. This reflects a complete loss of functional capacity in this domain and has implications for her long-term independence and participation.
[Esther]
Esther demonstrates extreme difficulty completing household tasks. She cannot engage in meal preparation, cleaning, or other domestic activities due to cognitive, motor, and communication impairments. She requires full support and supervision for all household-related tasks.
[Esther]
Esther experiences extreme difficulty participating in educational activities. Her intellectual disability, severe language delay, and behavioural challenges prevent her from functioning in a mainstream classroom without intensive, individualised support. She requires special education programs, tailored learning strategies, and continuous supervision to engage meaningfully.
[Glenn]
Glenn presents with significant impairments in communication due to his psychosocial disability, cognitive deficits, and the presence of psychotic symptoms. His communication challenges affect both his ability to understand information (receptive communication) and his ability to express himself clearly (expressive communication), resulting in substantial functional limitations across daily life and support settings.
[Glenn]
Glenn demonstrates marked deficits in receptive communication, largely driven by severe cognitive impairment, information-processing difficulties, and psychotic symptoms such as hallucinations and delusional thinking. He often struggles to understand verbal instructions, retain information, or follow multi-step tasks. Complex or abstract communication is particularly challenging, and Glenn requires information to be delivered slowly, clearly, and in simplified and repeated formats.
[Lenore]
Lenore cognitive and communication both expressive and receptive skills are well intact. Lenore has no significant communication deficits, and she can understand instructions combined with active listening. She speaks clearly and can interpret emotions and intentions behind a message. There is however a developing concern on ataxia-related expressive speech impairment needing further investigation and ongoing monitoring.
[Glenn]
Glenn's social participation reflects substantial support needs and significant limitations due to his psychosocial disability, cognitive impairments, and environmental vulnerabilities. While Glenn values friendships, his current social connections are not pro-social and predominantly revolve around substance use. This exposes him to unsafe environments, reinforces maladaptive behaviours, and further reduces his ability to form healthy and meaningful relationships.
[Glenn]
Glenn's overall level of societal participation falls within the 'extreme' severity range, indicating profound and pervasive impairment. He demonstrates severe limitations in his ability to engage with community resources, participate in social interactions, or maintain positive social relationships without support. He is unable to independently access activities, community settings, or social opportunities, and requires consistent, ongoing assistance to support safe community engagement and prevent isolation.
[Jose]
Jose experiences severe limitations in social participation and community engagement due to his psychosocial disability. He is unable to interact with the community, access resources, or participate in social activities independently, requiring constant support from caregivers to facilitate engagement.
[Daniel]
Daniel experiences severe limitations in social participation and community engagement due to his psychosocial disability. He is unable to interact safely or appropriately with the community, access resources, or participate in social activities independently. His interactions are often marked by verbal aggression, racial and sexual slurs, and boundary violations, which create significant risks for himself and others.
[Lenore]
Lenore is a warm, friendly, and socially inclined individual who interacts well with her community. Lenore's sense of humour and outgoing personally cannot be denied. Despite her physical limitations, Lenore continues to enjoy community access visits. She loves to sing and hang around with friends and family. These supported experiences have been shown to positively contribute to her emotional well-being and quality of life and markedly reduced mental health impairments.
[Esther]
Esther's play skills and peer interactions are significantly impacted by her disability, which affects communication, sensorimotor abilities, cognitive processing, and social functioning. According to her mother, Leatycia, Esther generally prefers solitary play and shows minimal interest in engaging with other children at school or community play centres. She demonstrates limited constructive interaction, struggles with turn-taking, and has difficulty understanding social rules and expected behaviours.
[Glenn]
Glenn demonstrates moderate functional limitations in memory, comprehension, and processing of verbal information. He experiences difficulty remembering important tasks, retaining new information, and understanding multi-step or complex verbal instructions. These cognitive deficits impact his ability to manage daily routines, follow instructions, problem-solve, and participate effectively in productive or structured activities. Glenn requires ongoing Occupational Therapy, the implementation of structured cognitive strategies, and consistent carer support to compensate for memory and comprehension deficits, optimise daily functioning, and reduce the risk of further decline in key life domains.
[Lenore]
Lenore demonstrates largely intact cognitive functioning. She is generally able to understand information, communicate effectively, and make decisions regarding her daily activities and health needs. Any difficulties in this domain are mild and do not significantly limit her ability to engage with others or participate in planning and decision-making.
[Lenore]
Lenore's ability to learn new skills is significantly affected by the progressive nature of her disability, which results in impairments of physical and motor skills. Her disability restricts her capacity to engage and participate in hands-on learning activities that require fine or gross motor coordination.
[Glenn]
Glenn reports mild impairments in physical mobility, traced back to the work-related accident and general aging. He is able to walk for extended periods and navigate long distances and enjoys walking around the Darwin CBD and local shopping centres. His mobility strengths contribute positively to his community participation and independence. However, Glenn requires transport assistance to attend appointments and to support safe access to community activities that involve longer distances, unfamiliar environments, or additional mobility demands.
[Jose]
Jose was observed to mobilize around the home and up the stairs without needing support. He is fully capable of moving independently within his environment and does not require assistance for walking, navigating stairs, or other mobility-related tasks. He however requires ongoing support to plan and maintain active living strategies as preventative management for lifestyle challenges associated with sedentary life. Jose explained he likes to walk at Casuarina Mall where there is air-conditioned space.
[Daniel]
Daniel demonstrates no difficulty with physical mobility. He can move independently within his environment, including navigating stairs and community spaces. However, mobility-related community participation requires planning and transport support, particularly given his behavioural risks and need for structured supervision in public settings.
[Lenore]
Lenore's physical disability has a significant and progressive impact on her mobility, balance, and motor coordination. Her neurological condition affects lower-limb strength, motor control, and postural stability, resulting in impaired static and dynamic balance and a high ongoing risk of falls. Lenore is unable to ambulate safely without mobility aids and requires support to maintain balance during standing and walking activities. Lenore currently mobilises with a walking stick for very short distances indoors and relies on a four-wheeled walker for household mobility and all community access.
[Lenore]
Lenore reports difficulty with activities such as cutting vegetables, opening screw-top jars, cutting meat, and managing utensils, as well as a noticeable deterioration in her handwriting. These fine motor impairments significantly reduce her independence in daily activities including meal preparation, cooking, cleaning, dressing, personal hygiene, and household management.
[Esther]
Esther's mobility is within the 'mild' range. A descriptor of 'mild' suggests that Esther may encounter some challenges in mobility. She may experience struggles in specific activities such as walking long distances, climbing stairs, or maintaining balance. Her poor balance, coordination, and core strength affect participation in age-appropriate physical activities. She requires ongoing occupational therapy and structured physical programs to improve motor skills and prevent secondary complications.
CRITICAL: ALL LSP-16 subscales — HIGHER = WORSE. A high Withdrawal score means severe social withdrawal, NOT good social skills. A high Self-Care score means severe self-care deficits, NOT a strength.
[Lenore]
Lenore's LSP-16 result indicates generally intact psychosocial functioning, with targeted needs in physical mobility and self-care and no behavioural risk. The profile is consistent with a spinocerebellar degenerative ataxia diagnosis which is primarily a physical/neurological disability rather than a psychosocial/behavioural disorder.
[Lenore]
Withdrawal (Score: 1/12) — Lenore shows minimal signs of social withdrawal. She does not experience difficulty initiating or responding to conversation and demonstrates warmth toward others. She is able to establish and maintain friendships adequately. There is only slight withdrawal noted, which is likely secondary to fatigue, mobility limitations.
[Lenore]
Self-Care (Score: 8/15) — Lenore demonstrates moderate impairment in self-care functioning. She is able to present as well-groomed and wear clean clothing; however, this is achieved with support, reflecting reduced physical capacity rather than lack of insight or motivation.
[Jose]
Withdrawal (Score: 7/12) — Jose demonstrates moderate social withdrawal and interpersonal difficulties. He struggles to initiate and respond to conversation, maintain friendships, and show warmth to others. These challenges severely restrict his ability to engage socially and form meaningful relationships. Without structured support and engagement strategies, Jose is at risk of isolation and emotional distress.
[Jose]
Self-Care (Score: 11/15) — Jose shows severe impairments in self-care. He is extremely poorly groomed, wears unclean clothes, and neglects aspects of physical health. He also struggles to maintain an adequate diet and is only capable of sheltered work. These limitations place him at risk of poor hygiene, malnutrition, and medical complications.
[Daniel]
Withdrawal (Score: 10/12) — Daniel demonstrates marked social withdrawal and interpersonal difficulties. He struggles to initiate and respond to conversation, shows no warmth to others, and has considerable difficulty maintaining friendships. These challenges severely restrict his ability to engage socially and form meaningful relationships.
[Daniel]
Self-Care (Score: 13/15) — Daniel shows severe impairments in self-care. He is poorly groomed, wears unclean clothes, neglects physical health, and fails to maintain an adequate diet. He is totally incapable of work. These limitations place him at risk of poor hygiene, malnutrition, and medical complications. Daily support is essential for personal hygiene and nutrition.
[Glenn]
Without ongoing assistance, Glenn is at increased risk of social isolation, reduced well-being, exacerbation of negative symptoms, and disengagement from meaningful activities. Consistent support is required to facilitate safe participation and enhance social inclusion.
[Glenn]
Without this assistance, his health, safety, and living conditions deteriorate rapidly.
[Glenn]
Without support, these deficits contribute to poor living conditions, tenancy instability, and heightened health and safety risks.
[Glenn]
Without consistent therapeutic input, structured routines, and reliable daily living supports, Glenn remains at high risk of deterioration in mental health and day-to-day functioning.
[Glenn]
Without this support, Glenn is at risk of misunderstanding instructions, missing key information, and making unsafe or uninformed decisions.
[Jose]
Without structured support and engagement strategies, Jose is at risk of isolation and emotional distress.
[Jose]
Without consistent therapeutic and environmental supports, these symptoms pose a high risk of deterioration in mental health and functioning.
[Jose]
Without targeted interventions, Jose remains at high risk of miscommunication, disengagement, and functional decline.
[Jose]
Without these supports, Jose remains at high risk of social exclusion and further functional decline.
[Daniel]
Without this support, Daniel has been observed to go for days without basic personal hygiene.
[Daniel]
Without consistent intervention, Daniel faces a high risk of neglect, poor health outcomes, and social isolation.
[Daniel]
Without structured support and engagement strategies, Daniel is at high risk of isolation and emotional distress.
[Daniel]
Without consistent therapeutic and environmental supports, these symptoms pose a high risk of deterioration in mental health and daily functioning.
[Daniel]
Without these supports, Daniel remains at high risk of social exclusion, escalation to aggression, and further functional decline, which may result in harm to others and loss of housing stability.
[Lenore]
Without appropriate accommodation, environmental modifications, and ongoing NDIS supports in place, Lenore is at significant risk of injury, loss of independence, and further functional deterioration.
[Lenore]
Without consistent therapeutic and functional supports in place, Lenore's safety, independence, and capacity to participate in daily life and the community will be significantly compromised.
[Lenore]
Without assistance, Lenore is at increased risk of loss of balance and falls during dressing tasks.
[Lenore]
Without ongoing OT intervention, Lenore is at high risk of accelerated functional decline due to the progressive nature of her neurological disability.
[Esther]
Without intensive, individualised support, Esther will continue to experience profound challenges in skill development and educational growth, placing her at high risk of long-term functional disadvantage compared to her same-aged peers.
[Esther]
Without intensive intervention, Esther remains at high risk of long-term functional disadvantage compared to her same-aged peers.
[Esther]
Without targeted interventions, her ability to participate in daily activities and community life will continue to regress.
[Esther]
Without intensive support, Esther will remain unable to access learning opportunities, resulting in widening gaps compared to her same-aged peers and reduced future independence.
[Esther]
According to her mother, Leatycia, Esther's spoken words are often difficult to understand, and her expressive communication is markedly impaired, with inconsistent speech intelligibility.
[Esther]
According to her mother, Leatycia, Esther generally prefers solitary play and shows minimal interest in engaging with other children at school or community play centres.
[Esther]
According to her mother, Esther struggles with transitions between home and school, often exhibiting behaviours of concern that have led to multiple suspensions, further limiting her learning opportunities.
[Glenn]
According to previous reports, his parents separated when he was four years old.
[Glenn]
Glenn reports that he generally sleeps well but requires a quiet, calm, and regulated environment to do so.
[Jose]
Therapist noted that Jose was exhibiting symptoms in line with a diagnosis of schizophrenia.
BANNED: 'demonstrates' as catch-all verb (max 10 uses per full report). 'Experiences difficulty with' (replace with 'cannot' or 'is unable to'). 'Indicating' as sentence connector. 'Suggesting' as paragraph bridge. 'Functional capacity' more than 5 times per report. 'These challenges/limitations/deficits' more than once per report.
RULE: Every paragraph must contain at least one sentence under 12 words. This creates rhythm that distinguishes clinical authority from generic AI output.`;

// ── System prompt for Claude ────────────────────────────────
function buildSystemPrompt(): string {
  return `You are a clinical writing quality editor for Australian NDIS Functional Capacity Assessment reports.

YOUR TASK:
Rewrite the provided report section text to improve clinical writing quality while preserving ALL clinical content exactly.

ABSOLUTE RULES — NEVER VIOLATE:
- Preserve ALL clinical facts, scores, dates, names, and placeholders EXACTLY as given.
- Preserve ALL [bracketed placeholders] exactly as written.
- Do NOT add, remove, or change any clinical information.
- Do NOT change any assessment scores, numerical values, or dates.
- Do NOT change the participant's name or any other proper nouns.
- Only change the EXPRESSION — word choice, sentence structure, voice — for stronger clinical writing.

WRITING IMPROVEMENTS TO APPLY:
- Use active verbs: 'requires', 'cannot', 'is unable to', 'needs' instead of passive constructions like 'demonstrates', 'experiences difficulty', 'was observed to'.
- Vary sentence length — include at least one short sentence (<12 words) per paragraph for impact.
- Eliminate hedging language: replace 'appears to', 'seems to', 'may potentially' with direct statements where clinically appropriate.
- Tighten wordy phrases: 'due to the fact that' → 'because', 'in order to' → 'to'.
- Ensure observation → functional impact → support need flow in each domain paragraph.
- Maintain professional, measured, objective tone throughout.
- No bullet points — continuous prose paragraphs only.
- No markdown formatting. Plain text only.

OUTPUT:
Return ONLY the rewritten section text. No preamble, no commentary, no explanations.

STYLE GUIDE (extracted from accepted NDIS FCA reports — match this voice):
---
${STYLE_GUIDE.slice(0, 12000)}
---`;
}

// ── Main handler ────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    if (!CLAUDE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "CLAUDE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { generated_text, section_name, participant_name, participant_first_name } = body;

    if (!generated_text || typeof generated_text !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "generated_text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = buildSystemPrompt();

    const userPrompt = `Section: ${section_name || "unknown"}
${participant_name ? `Participant name: ${participant_name}` : ""}
${participant_first_name ? `Participant first name: ${participant_first_name}` : ""}

TEXT TO REFINE:
${generated_text}`;

    console.log(`REFINE: Processing section "${section_name}" (${generated_text.length} chars)`);

    // Call Claude
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const originalWordCount = generated_text.split(/\s+/).filter(Boolean).length;

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error("REFINE: Claude API error:", claudeRes.status, errText);
      return new Response(
        JSON.stringify({
          success: true,
          refined_text: generated_text,
          original_text: generated_text,
          word_count_original: originalWordCount,
          word_count_refined: originalWordCount,
          warnings: ["Refinement unavailable — original text returned"],
          fallback: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await claudeRes.json();
    const refinedText = data.content
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n")
      .trim();

    const refinedWordCount = refinedText.split(/\s+/).filter(Boolean).length;
    const warnings: string[] = [];

    const ratio = refinedWordCount / originalWordCount;
    if (ratio < 0.6) {
      warnings.push(`Refined text is significantly shorter than original (${refinedWordCount} vs ${originalWordCount} words — ${Math.round(ratio * 100)}%)`);
    }
    if (ratio > 1.5) {
      warnings.push(`Refined text is significantly longer than original (${refinedWordCount} vs ${originalWordCount} words — ${Math.round(ratio * 100)}%)`);
    }

    if (participant_name && !refinedText.includes(participant_name) && generated_text.includes(participant_name)) {
      warnings.push(`Participant name "${participant_name}" may have been altered during refinement`);
    }

    console.log(`REFINE: Complete. ${originalWordCount} → ${refinedWordCount} words. ${warnings.length} warnings.`);

    return new Response(
      JSON.stringify({
        success: true,
        refined_text: refinedText,
        original_text: generated_text,
        word_count_original: originalWordCount,
        word_count_refined: refinedWordCount,
        warnings,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    console.error("REFINE: Unhandled error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
