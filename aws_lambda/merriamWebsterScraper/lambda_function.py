import json
import requests
import re
from bs4 import BeautifulSoup


def lambda_handler(event, context):
    if event['function'] == 'get_num_pages':
        return get_num_pages(event['letter'])
    else:
        return get_words_and_definitions(event['letter'], event['page_number'])


def get_num_pages(letter):
    num_pages = -1
    requests_session = requests.Session()
    url = "https://www.merriam-webster.com/browse/dictionary/" + \
        letter + "/1"
    req = requests_session.get(url)
    bsObj = BeautifulSoup(req.text, "html.parser")
    page_num_data = bsObj.findAll("span", class_="counters")
    for p in page_num_data:
        r = re.match("page (\d+) of (\d+)", p.text)
        if r:
            g = r.groups()
            num_pages = g[1]
    return {
        'statusCode': 200,
        'body': num_pages
    }


def get_words_and_definitions(letter, page_number):
    definitions_per_word = {}
    requests_session = requests.Session()
    url = "https://www.merriam-webster.com/browse/dictionary/" + \
        letter + "/" + str(page_number)
    req = requests_session.get(url)
    bs_obj = BeautifulSoup(req.text, "html.parser")
    word_data = bs_obj.find_all("a", class_="d-block")
    for i in range(len(word_data)):
        word = word_data[i].text
        definitions = get_definitions(word, requests_session)
        if len(definitions) > 0:
            definitions_per_word[word] = definitions

    return {
        'statusCode': 200,
        'body': json.dumps(definitions_per_word)
    }


def get_definitions(word, requests_session):
    definitions_per_part_of_speech = {}
    word_url = "https://www.merriam-webster.com/dictionary/" + word
    word_req = requests_session.get(word_url)
    word_html = BeautifulSoup(word_req.text, "html.parser")

    # skip blank pages which seem to exist because of a bug in the website
    word_tag = word_html.find(class_='hword')
    if not word_tag:
        return {}

    definitions = get_definition_elements(word_html)
    if len(definitions) == 0:
        if word_definition_not_in_dictionary(word_html):
            return {}

        synonyms = get_synonyms(word_html, word)
        if len(synonyms) == 0:
            raise Exception(
                "No definitions or synonyms found for word " + word + ".")

        try:
            return get_definition_from_synonyms(synonyms, requests_session)
        except:
            raise Exception("No definitions found for word " +
                            word + " or its synonyms: " + str(synonyms))

    if len(definitions) == 1:
        regex = r"see\s+([-_'\w\u0080-\uFFFF]+)"
        r = re.match(regex, definitions[0].text.replace("\n", " ").strip())
        if r:
            return get_definitions(r.group(1), requests_session)

    definition_entries = word_html.select(
        '.entry-word-section-container:not(.entry-word-section-container-supplemental)')
    for i, d in enumerate(definition_entries):
        # find part of speech from the most recent previous element with class "part-of-speech"
        part_of_speech = get_part_of_speech(d)

        if part_of_speech not in definitions_per_part_of_speech:
            definitions_per_part_of_speech[part_of_speech] = []
        definitions_for_curr_part_of_speech = []
        dt_text = d.findAll(class_="dtText") + d.findAll(class_="unText")
        for dt in dt_text:
            for jump in dt.findAll(class_="dx-jump"):
                jump.decompose()
        for dt in dt_text:
            definitions_for_curr_part_of_speech.append(dt.text)

        if len(definitions_for_curr_part_of_speech) == 0:
            definitions_for_curr_part_of_speech = [d.text.replace("\n", " ")]
        for definition in definitions_for_curr_part_of_speech:
            if definition.startswith(":"):
                definition = definition[1:]
            definition = re.sub(
                r'\([^)]*see\s+\S+\s*.*\) ?', '', definition)
            definition = re.sub(
                r'entry \d+[a-z]*', '', definition)
            definition = re.sub(
                r'sense \d+[a-z]*', '', definition)
            definition = definition.strip()
            definitions_per_part_of_speech[part_of_speech].append(
                definition)
    return definitions_per_part_of_speech


def get_definition_elements(word_html):
    definition_elements = []
    classes = ["vg"]
    for c in classes:
        definition_elements += word_html.findAll(class_=c)
    return definition_elements


def get_part_of_speech(definition_element):
    part_of_speech = definition_element.find(class_="parts-of-speech")
    if part_of_speech:
        return part_of_speech.text
    return ''


def word_definition_not_in_dictionary(word_html):
    # Sometimes this happens due to an error on the website.
    spelling_suggestion = word_html.find_all(class_="spelling-suggestion-text")
    return len(spelling_suggestion) > 0 and "The word you've entered isn't in the dictionary" in spelling_suggestion[0].text


def get_definition_from_synonyms(synonyms, requests_session):
    for synonym in synonyms:
        try:
            return get_definitions(synonym, requests_session)
        except:
            continue
    raise Exception("No definitions found")


def get_synonyms(word_html, word):
    synonyms = []
    synonym_elements = []
    classes = ["cxl-ref"]
    for c in classes:
        synonym_elements += word_html.findAll(class_=c)
    for s in synonym_elements:
        synonym_element_text = s.text.replace("\n", " ")
        r = re.search(r"of\s+([-_', \w\u0080-\uFFFF]+)", synonym_element_text)
        if r:
            synonyms_in_curr_element = r.group(1).split(", ")
            for synonym in synonyms_in_curr_element:
                synonym = synonym.strip()
                if synonym != word:
                    synonyms.append(synonym)
    return synonyms
